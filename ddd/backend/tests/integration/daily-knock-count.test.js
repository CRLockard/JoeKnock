import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;

async function fixture({
  timezone = 'America/New_York',
  noSettings = false,
} = {}) {
  const org = (
    await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [
      `Knock org ${randomUUID()}`,
    ])
  ).rows[0].id;
  if (!noSettings) {
    await query(
      `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
       VALUES ($1, 'own', $2)`,
      [org, timezone],
    );
  }
  const user = (
    await query(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, 'x', 'K', 'Rep', 'rep', true) RETURNING id, organization_id, role`,
      [org, `knock.${randomUUID()}@example.com`],
    )
  ).rows[0];
  const status = (
    await query(
      `INSERT INTO statuses (organization_id, name, display_order, is_active)
       VALUES ($1, 'No Answer', 1, true) RETURNING id`,
      [org],
    )
  ).rows[0].id;
  const property = (
    await query(
      `INSERT INTO properties (organization_id, address_line_1, city, state, postal_code, country, normalized_address, latitude, longitude)
       VALUES ($1, '1 Main St', 'X', 'TN', '37901', 'US', $2, 35.5, -84.1) RETURNING id`,
      [org, `n-${randomUUID()}`],
    )
  ).rows[0].id;
  const token = signAccessToken({
    userId: user.id,
    organizationId: org,
    role: user.role,
  });
  return { org, user, status, property, token };
}

describeDb('daily knock count', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestMigrations();
  });

  const visit = (f, property = f.property) =>
    request(app)
      .post(`/api/properties/${property}/interactions`)
      .set('Authorization', `Bearer ${f.token}`)
      .send({ clientRequestId: randomUUID(), statusId: f.status });

  const counts = async (f) =>
    (
      await query(
        `SELECT knock_date::text AS d, knocks FROM daily_knocks WHERE organization_id = $1`,
        [f.org],
      )
    ).rows;

  it('awards one count to a first visit with the frozen local date', async () => {
    const f = await fixture();
    expect((await visit(f)).status).toBe(201);
    const rows = await counts(f);
    expect(rows).toHaveLength(1);
    expect(rows[0].knocks).toBe(1);
  });

  it('adds no count for a same-day repeat or an edit', async () => {
    const f = await fixture();
    const first = await visit(f);
    expect((await visit(f)).status).toBe(409);
    const edit = await request(app)
      .post(`/api/interactions/${first.body.interaction?.id ?? first.body.id}`)
      .set('Authorization', `Bearer ${f.token}`)
      .send({ notes: 'edited' });
    expect(edit.status).toBeLessThan(500);
    const total = await query(
      `SELECT count(*) FILTER (WHERE counts_as_daily_knock)::int AS counted,
              count(DISTINCT interaction_group_id)::int AS groups
       FROM interactions WHERE organization_id = $1`,
      [f.org],
    );
    expect(total.rows[0]).toEqual({ counted: 1, groups: 1 });
  });

  it('creates one history when concurrent requests use different clientRequestIds', async () => {
    const f = await fixture();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => visit(f)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([
      201, 409, 409, 409, 409, 409,
    ]);
    const groups = await query(
      `SELECT count(DISTINCT interaction_group_id)::int AS n FROM interactions WHERE organization_id = $1`,
      [f.org],
    );
    expect(groups.rows[0].n).toBe(1);
    expect((await counts(f))[0].knocks).toBe(1);
  });

  it('still replays the same clientRequestId without a second count', async () => {
    const f = await fixture();
    const clientRequestId = randomUUID();
    const send = () =>
      request(app)
        .post(`/api/properties/${f.property}/interactions`)
        .set('Authorization', `Bearer ${f.token}`)
        .send({ clientRequestId, statusId: f.status });
    const results = await Promise.all([send(), send()]);
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect((await counts(f))[0].knocks).toBe(1);
  });

  it('rejects the unique rule when two counted rows share a local day (database backstop)', async () => {
    const f = await fixture();
    await visit(f);
    const src = (
      await query(`SELECT * FROM interactions WHERE organization_id = $1`, [
        f.org,
      ])
    ).rows[0];
    await expect(
      query(
        `INSERT INTO interactions (interaction_group_id, property_id, organization_id, user_id, status_id, status_name,
           initial_interaction_at, changed_at, changed_by, is_current, knock_date, counts_as_daily_knock)
         VALUES ($1,$2,$3,$4,$5,'No Answer', now(), now(), $4, true, $6, true)`,
        [
          randomUUID(),
          src.property_id,
          src.organization_id,
          src.user_id,
          src.status_id,
          src.knock_date,
        ],
      ),
    ).rejects.toMatchObject({ constraint: 'interactions_daily_knock_unique' });
  });

  it.each([
    ['missing settings', { noSettings: true }],
    ['unrecognized timezone', { timezone: 'Mars/Olympus' }],
    ['empty timezone', { timezone: '' }],
  ])('rejects new visits with %s and writes nothing', async (_l, options) => {
    const f = await fixture(options);
    const response = await visit(f);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('ORGANIZATION_TIMEZONE_INVALID');
    const n = await query(
      `SELECT count(*)::int AS n FROM interactions WHERE organization_id = $1`,
      [f.org],
    );
    expect(n.rows[0].n).toBe(0);
  });

  it('keeps different reps and different properties counted separately', async () => {
    const f = await fixture();
    const other = (
      await query(
        `INSERT INTO properties (organization_id, address_line_1, city, state, postal_code, country, normalized_address, latitude, longitude)
         VALUES ($1, '2 Main St', 'X', 'TN', '37901', 'US', $2, 35.5, -84.1) RETURNING id`,
        [f.org, `n-${randomUUID()}`],
      )
    ).rows[0].id;
    expect((await visit(f)).status).toBe(201);
    expect((await visit(f, other)).status).toBe(201);
    expect(await counts(f)).toHaveLength(2);
  });
});
