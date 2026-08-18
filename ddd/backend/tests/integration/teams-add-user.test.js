import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
  resetRegistrationTables,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;

async function hasTeamMembershipSchema() {
  const result = await query(`
    SELECT
      to_regclass('public.organizations') AS organizations_table,
      to_regclass('public.organization_settings') AS settings_table,
      to_regclass('public.users') AS users_table,
      to_regclass('public.teams') AS teams_table,
      to_regclass('public.team_users') AS team_users_table
  `);

  const row = result.rows[0];

  return Boolean(
    row.organizations_table &&
    row.settings_table &&
    row.users_table &&
    row.teams_table &&
    row.team_users_table,
  );
}

async function ensureTeamMembershipSchemaReady() {
  if (await hasTeamMembershipSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasTeamMembershipSchema())) {
      throw error;
    }
  }
}

async function seedAuthenticatedUser({
  role = 'admin',
  email = `team-add.${Date.now()}@example.com`,
  organizationName = `Teams Add Org ${Date.now()}-${Math.random()}`,
  firstName = 'Corey',
  lastName = 'Lopez',
  isActive = true,
}) {
  const orgResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
    [organizationName],
  );

  const organization = orgResult.rows[0];

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', 'UTC')`,
    [organization.id],
  );

  const userResult = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, organization_id, role, email, first_name, last_name, is_active`,
    [
      organization.id,
      email.toLowerCase(),
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      firstName,
      lastName,
      role,
      isActive,
    ],
  );

  return {
    organization,
    user: userResult.rows[0],
    token: signAccessToken({
      userId: userResult.rows[0].id,
      organizationId: organization.id,
      role,
    }),
  };
}

async function createTeamRecord({ organizationId, name }) {
  const result = await query(
    `INSERT INTO teams (organization_id, name)
     VALUES ($1, $2)
     RETURNING id, organization_id, name, created_at, updated_at`,
    [organizationId, name],
  );

  return result.rows[0];
}

async function createUserRecord({
  organizationId,
  email,
  firstName,
  lastName,
  role = 'rep',
  isActive = true,
}) {
  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, organization_id, email, first_name, last_name, role, is_active`,
    [
      organizationId,
      email.toLowerCase(),
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      firstName,
      lastName,
      role,
      isActive,
    ],
  );

  return result.rows[0];
}

describeDb('POST /api/teams/:id/users', () => {
  beforeAll(async () => {
    await ensureTeamMembershipSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('allows a manager to add an organization user to a team', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'North Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-mgr.${Date.now()}@example.com`,
      firstName: 'Ana',
      lastName: 'Able',
    });

    const response = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: member.id });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.teamId).toBe(team.id);
    expect(response.body.userId).toBe(member.id);
    expect(response.body.createdAt).toBeTruthy();

    const stored = await query(
      'SELECT organization_id, team_id, user_id FROM team_users WHERE team_id = $1 AND user_id = $2',
      [team.id, member.id],
    );

    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].organization_id).toBe(actor.organization.id);
    expect(stored.rows[0].team_id).toBe(team.id);
    expect(stored.rows[0].user_id).toBe(member.id);
  });

  it('allows an admin to add an organization user to a team', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'South Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-admin.${Date.now()}@example.com`,
      firstName: 'Blake',
      lastName: 'Baker',
    });

    const response = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: member.id });

    expect(response.status).toBe(201);
    expect(response.body.teamId).toBe(team.id);
    expect(response.body.userId).toBe(member.id);
  });

  it('returns 409 when membership already exists', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Duplicate Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-dup.${Date.now()}@example.com`,
      firstName: 'Casey',
      lastName: 'Clark',
    });

    const first = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: member.id });

    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: member.id });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');

    const count = await query(
      'SELECT COUNT(*)::int AS count FROM team_users WHERE team_id = $1 AND user_id = $2',
      [team.id, member.id],
    );

    expect(count.rows[0].count).toBe(1);
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/teams/2f433953-d5ec-466a-ba42-6252e27f3ad0/users')
      .send({ userId: '8d3be711-07b6-4f76-bb06-ef2f0b5547f7' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects representative role access', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Role Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-role.${Date.now()}@example.com`,
      firstName: 'Drew',
      lastName: 'Diaz',
    });

    const response = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: member.id });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for nonexistent team in authenticated organization scope', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-no-team.${Date.now()}@example.com`,
      firstName: 'Evan',
      lastName: 'Edwards',
    });

    const response = await request(app)
      .post('/api/teams/2f433953-d5ec-466a-ba42-6252e27f3ad0/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: member.id });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 404 for nonexistent user in authenticated organization scope', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'No User Team',
    });

    const response = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: '8d3be711-07b6-4f76-bb06-ef2f0b5547f7' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('validates malformed team id and user id', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const invalidTeamIdResponse = await request(app)
      .post('/api/teams/not-a-uuid/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: '8d3be711-07b6-4f76-bb06-ef2f0b5547f7' });

    expect(invalidTeamIdResponse.status).toBe(400);
    expect(invalidTeamIdResponse.body.error.code).toBe('VALIDATION_ERROR');

    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Validation Team',
    });

    const invalidUserIdResponse = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: 'not-a-uuid' });

    expect(invalidUserIdResponse.status).toBe(400);
    expect(invalidUserIdResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cannot add a user from another organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Org Isolation Team',
    });

    const outsideUser = await createUserRecord({
      organizationId: other.organization.id,
      email: `outside-user.${Date.now()}@example.com`,
      firstName: 'Finn',
      lastName: 'Ford',
    });

    const response = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: outsideUser.id });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const rows = await query(
      'SELECT COUNT(*)::int AS count FROM team_users WHERE team_id = $1',
      [team.id],
    );

    expect(rows.rows[0].count).toBe(0);
  });

  it('cannot modify a team from another organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const outsideTeam = await createTeamRecord({
      organizationId: other.organization.id,
      name: 'Outside Team',
    });

    const insideUser = await createUserRecord({
      organizationId: actor.organization.id,
      email: `inside-user.${Date.now()}@example.com`,
      firstName: 'Gray',
      lastName: 'Green',
    });

    const response = await request(app)
      .post(`/api/teams/${outsideTeam.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: insideUser.id });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const rows = await query(
      'SELECT COUNT(*)::int AS count FROM team_users WHERE team_id = $1',
      [outsideTeam.id],
    );

    expect(rows.rows[0].count).toBe(0);
  });

  it('ignores client-supplied organization ownership selectors', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Owned Team',
    });

    const outsideUser = await createUserRecord({
      organizationId: other.organization.id,
      email: `outside-org-selector.${Date.now()}@example.com`,
      firstName: 'Harper',
      lastName: 'Hall',
    });

    const response = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        userId: outsideUser.id,
        organizationId: actor.organization.id,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const rows = await query(
      'SELECT COUNT(*)::int AS count FROM team_users WHERE team_id = $1',
      [team.id],
    );

    expect(rows.rows[0].count).toBe(0);
  });

  it('keeps team detail member behavior intact after adding membership', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Detail Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-detail.${Date.now()}@example.com`,
      firstName: 'Ira',
      lastName: 'Iverson',
      role: 'rep',
    });

    const addResponse = await request(app)
      .post(`/api/teams/${team.id}/users`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ userId: member.id });

    expect(addResponse.status).toBe(201);

    const detailResponse = await request(app)
      .get(`/api/teams/${team.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: member.id,
          organizationId: actor.organization.id,
          email: member.email,
        }),
      ]),
    );
  });
});
