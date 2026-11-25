import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { getPool, query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;

async function organization() {
  const { rows } = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [`Manager policy ${randomUUID()}`],
  );
  const id = rows[0].id;
  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', 'UTC')`,
    [id],
  );
  return id;
}

async function user(org, role) {
  const { rows } = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, 'x', 'Policy', 'Tester', $3, true) RETURNING id`,
    [org, `${randomUUID()}@example.com`, role],
  );
  const id = rows[0].id;
  return {
    id,
    token: signAccessToken({ userId: id, organizationId: org, role }),
  };
}

async function team(org, users = []) {
  const { rows } = await query(
    'INSERT INTO teams (organization_id, name) VALUES ($1, $2) RETURNING id',
    [org, `Team ${randomUUID()}`],
  );
  const id = rows[0].id;
  for (const member of users) {
    await query(
      'INSERT INTO team_users (organization_id, team_id, user_id) VALUES ($1, $2, $3)',
      [org, id, member.id],
    );
  }
  return id;
}

async function members(teamId) {
  const { rows } = await query(
    'SELECT user_id FROM team_users WHERE team_id = $1 ORDER BY user_id',
    [teamId],
  );
  return rows.map((row) => row.user_id);
}

async function waitForBlockedTransaction(blockerPid) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { rows } = await query(
      'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked',
      [blockerPid],
    );
    if (rows[0].blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Membership request did not wait for the concurrent change.');
}

describeDb('manager access boundaries', () => {
  const app = createApp();
  beforeAll(async () => {
    await ensureTestMigrations();
  });

  const add = (actor, teamId, userId) =>
    request(app)
      .post(`/api/teams/${teamId}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId });
  const remove = (actor, teamId, userId) =>
    request(app)
      .delete(`/api/teams/${teamId}/users/${userId}`)
      .set('Authorization', `Bearer ${actor.token}`);

  it('allows managers to add and remove reps only on their own teams', async () => {
    const org = await organization();
    const manager = await user(org, 'manager');
    const rep = await user(org, 'rep');
    const anotherRep = await user(org, 'rep');
    const ownTeam = await team(org, [manager]);
    const unrelated = await team(org, [rep]);

    expect((await add(manager, ownTeam, rep.id)).status).toBe(201);
    expect(await members(ownTeam)).toEqual([manager.id, rep.id].sort());
    expect((await remove(manager, ownTeam, rep.id)).status).toBe(200);
    expect(await members(ownTeam)).toEqual([manager.id]);

    const before = await members(unrelated);
    expect((await add(manager, unrelated, manager.id)).status).toBe(403);
    expect((await add(manager, unrelated, anotherRep.id)).status).toBe(403);
    expect((await remove(manager, unrelated, rep.id)).status).toBe(403);
    expect(await members(unrelated)).toEqual(before);
  });

  it('rejects manager self, manager and admin targets without changing memberships', async () => {
    const org = await organization();
    const manager = await user(org, 'manager');
    const otherManager = await user(org, 'manager');
    const admin = await user(org, 'admin');
    const ownTeam = await team(org, [manager, otherManager, admin]);
    const before = await members(ownTeam);
    for (const target of [manager, otherManager, admin]) {
      expect((await add(manager, ownTeam, target.id)).status).toBe(403);
      expect((await remove(manager, ownTeam, target.id)).status).toBe(403);
      expect(await members(ownTeam)).toEqual(before);
    }

    const emptyTargets = await team(org, [manager]);
    for (const target of [otherManager, admin]) {
      expect((await add(manager, emptyTargets, target.id)).status).toBe(403);
      expect(await members(emptyTargets)).toEqual([manager.id]);
    }
  });

  it('keeps cross-organization teams and targets inaccessible for both methods', async () => {
    const org = await organization();
    const foreign = await organization();
    const manager = await user(org, 'manager');
    const rep = await user(org, 'rep');
    const foreignRep = await user(foreign, 'rep');
    const ownTeam = await team(org, [manager]);
    const foreignTeam = await team(foreign, [foreignRep]);
    const beforeOwn = await members(ownTeam);
    const beforeForeign = await members(foreignTeam);
    for (const [teamId, target] of [
      [ownTeam, foreignRep],
      [foreignTeam, rep],
    ]) {
      expect((await add(manager, teamId, target.id)).status).toBe(404);
      expect((await remove(manager, teamId, target.id)).status).toBe(404);
    }
    expect(await members(ownTeam)).toEqual(beforeOwn);
    expect(await members(foreignTeam)).toEqual(beforeForeign);
  });

  it('preserves admin ability to manage all same-organization roles', async () => {
    const org = await organization();
    const admin = await user(org, 'admin');
    const manager = await user(org, 'manager');
    const rep = await user(org, 'rep');
    const teamId = await team(org);
    for (const target of [admin, manager, rep]) {
      expect((await add(admin, teamId, target.id)).status).toBe(201);
      expect((await remove(admin, teamId, target.id)).status).toBe(200);
    }
    expect(await members(teamId)).toEqual([]);
  });

  it.each(['membership revoked', 'target promoted', 'actor demoted'])(
    'rechecks authorization after waiting for a concurrent %s',
    async (change) => {
      const org = await organization();
      const manager = await user(org, 'manager');
      const rep = await user(org, 'rep');
      const teamId = await team(org, [manager]);
      const client = await getPool().connect();
      let pending;
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT pg_backend_pid() AS pid');
        if (change === 'membership revoked') {
          await client.query(
            'DELETE FROM team_users WHERE organization_id = $1 AND team_id = $2 AND user_id = $3',
            [org, teamId, manager.id],
          );
        } else if (change === 'target promoted') {
          await client.query('UPDATE users SET role = $1 WHERE id = $2', [
            'manager',
            rep.id,
          ]);
        } else {
          await client.query('UPDATE users SET role = $1 WHERE id = $2', [
            'rep',
            manager.id,
          ]);
        }
        pending = add(manager, teamId, rep.id).then((response) => response);
        await waitForBlockedTransaction(rows[0].pid);
        await client.query('COMMIT');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      const response = await pending;
      expect(response.status).toBe(403);
      expect(await members(teamId)).toEqual(
        change === 'membership revoked' ? [] : [manager.id],
      );
    },
  );

  it('denies catalog writes and organization administration while retaining active status reads', async () => {
    const org = await organization();
    const manager = await user(org, 'manager');
    const admin = await user(org, 'admin');
    const auth = `Bearer ${manager.token}`;
    const created = await request(app)
      .post('/api/statuses')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Existing' });
    expect(created.status).toBe(201);
    const statusId = created.body.id;
    expect(
      (await request(app).get('/api/statuses').set('Authorization', auth)).body,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: statusId })]),
    );
    expect(
      (
        await request(app)
          .post('/api/statuses')
          .set('Authorization', auth)
          .send({ name: 'Denied' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/statuses/${statusId}`)
          .set('Authorization', auth)
          .send({ name: 'Denied' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/statuses/${statusId}/active`)
          .set('Authorization', auth)
          .send({ isActive: false })
      ).status,
    ).toBe(403);
    for (const path of ['/api/organization', '/api/organization/settings']) {
      expect(
        (await request(app).get(path).set('Authorization', auth)).status,
      ).toBe(403);
    }
    expect(
      (
        await request(app)
          .patch('/api/organization/settings')
          .set('Authorization', auth)
          .send({ timezone: 'UTC' })
      ).status,
    ).toBe(403);
    const result = await query(
      'SELECT name, is_active FROM statuses WHERE organization_id = $1',
      [org],
    );
    expect(result.rows).toEqual([{ name: 'Existing', is_active: true }]);
  });

  it('denied self-assignment cannot expand report or interaction edit access', async () => {
    const org = await organization();
    const manager = await user(org, 'manager');
    const rep = await user(org, 'rep');
    const admin = await user(org, 'admin');
    const otherTeam = await team(org, [rep]);
    const { rows: statuses } = await query(
      `INSERT INTO statuses (organization_id, name, display_order, is_active)
       VALUES ($1, 'Visit', 1, true) RETURNING id`,
      [org],
    );
    const { rows: properties } = await query(
      `INSERT INTO properties (organization_id, address_line_1, city, state, postal_code, country, normalized_address, latitude, longitude)
       VALUES ($1, '1 Test St', 'X', 'TN', '37901', 'US', $2, 35, -84) RETURNING id`,
      [org, randomUUID()],
    );
    const visit = await request(app)
      .post(`/api/properties/${properties[0].id}/interactions`)
      .set('Authorization', `Bearer ${rep.token}`)
      .send({ statusId: statuses[0].id, notes: 'Original' });
    expect(visit.status).toBe(201);
    const auth = `Bearer ${manager.token}`;
    const date = new Date().toISOString().slice(0, 10);
    const report = () =>
      request(app)
        .get(`/api/reports/activity?dateFrom=${date}&dateTo=${date}`)
        .set('Authorization', auth);
    const edit = () =>
      request(app)
        .post(`/api/interactions/${visit.body.interactionId}`)
        .set('Authorization', auth)
        .send({ notes: 'Denied' });
    expect((await report()).body.summary.totalKnocks).toBe(0);
    expect((await edit()).status).toBe(403);
    expect((await add(manager, otherTeam, manager.id)).status).toBe(403);
    expect(await members(otherTeam)).toEqual([rep.id]);
    expect((await report()).body.summary.totalKnocks).toBe(0);
    expect((await edit()).status).toBe(403);
    const stored = await query('SELECT notes FROM interactions WHERE id = $1', [
      visit.body.interactionId,
    ]);
    expect(stored.rows[0].notes).toBe('Original');
    expect((await add(admin, otherTeam, manager.id)).status).toBe(201);
    expect((await report()).body.summary.totalKnocks).toBe(1);
    expect((await edit()).status).toBe(200);
  });
});
