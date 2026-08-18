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

async function hasTeamsSchema() {
  const result = await query(`
    SELECT
      to_regclass('public.organizations') AS organizations_table,
      to_regclass('public.organization_settings') AS settings_table,
      to_regclass('public.users') AS users_table,
      to_regclass('public.teams') AS teams_table
  `);

  const row = result.rows[0];

  return Boolean(
    row.organizations_table &&
    row.settings_table &&
    row.users_table &&
    row.teams_table,
  );
}

async function ensureTeamsSchemaReady() {
  if (await hasTeamsSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasTeamsSchema())) {
      throw error;
    }
  }
}

async function seedAuthenticatedUser({
  role = 'admin',
  email = `team.${Date.now()}@example.com`,
  organizationName = `Teams Org ${Date.now()}-${Math.random()}`,
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
     RETURNING id, organization_id, role, email`,
    [
      organization.id,
      email.toLowerCase(),
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      'Corey',
      'Lopez',
      role,
      true,
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

describeDb('POST /api/teams', () => {
  beforeAll(async () => {
    await ensureTeamsSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('creates a team for an administrator within authenticated organization scope', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'North Knoxville' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('North Knoxville');
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.id).toBeTruthy();

    const rows = await query(
      'SELECT organization_id, name FROM teams WHERE id = $1',
      [response.body.id],
    );

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].organization_id).toBe(actor.organization.id);
    expect(rows.rows[0].name).toBe('North Knoxville');
  });

  it('creates a team for a manager within authenticated organization scope', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    const response = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'South Knoxville' });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.name).toBe('South Knoxville');
  });

  it('ignores client-supplied organization ownership selectors', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        name: 'Ignored Organization Override',
        organizationId: other.organization.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(actor.organization.id);

    const row = await query('SELECT organization_id FROM teams WHERE id = $1', [
      response.body.id,
    ]);

    expect(row.rows[0].organization_id).toBe(actor.organization.id);
    expect(row.rows[0].organization_id).not.toBe(other.organization.id);
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/teams')
      .send({ name: 'North Knoxville' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects representative role for team creation', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });

    const response = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'North Knoxville' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('validates missing or invalid team name', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    const emptyResponse = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: '' });

    expect(emptyResponse.status).toBe(400);
    expect(emptyResponse.body.error.code).toBe('VALIDATION_ERROR');

    const objectResponse = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({});

    expect(objectResponse.status).toBe(400);
    expect(objectResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('preserves organization isolation by creating only inside the authenticated organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    await query('INSERT INTO teams (organization_id, name) VALUES ($1, $2)', [
      other.organization.id,
      'Outside Team',
    ]);

    const response = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'Inside Team' });

    expect(response.status).toBe(201);

    const counts = await query(
      `SELECT
         COUNT(*) FILTER (WHERE organization_id = $1)::int AS actor_count,
         COUNT(*) FILTER (WHERE organization_id = $2)::int AS other_count
       FROM teams`,
      [actor.organization.id, other.organization.id],
    );

    expect(counts.rows[0].actor_count).toBe(1);
    expect(counts.rows[0].other_count).toBe(1);
  });
});
