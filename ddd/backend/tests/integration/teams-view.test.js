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
  email = `team-view.${Date.now()}@example.com`,
  organizationName = `Teams View Org ${Date.now()}-${Math.random()}`,
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

async function addUserToTeam({ organizationId, teamId, userId }) {
  await query(
    `INSERT INTO team_users (organization_id, team_id, user_id)
     VALUES ($1, $2, $3)`,
    [organizationId, teamId, userId],
  );
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

describeDb('GET /api/teams and GET /api/teams/:id', () => {
  beforeAll(async () => {
    await ensureTeamMembershipSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('returns organization teams for an authorized manager', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Alpha Team',
    });
    await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Beta Team',
    });

    const response = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((team) => team.name)).toEqual([
      'Alpha Team',
      'Beta Team',
    ]);
    for (const team of response.body) {
      expect(team.organizationId).toBe(actor.organization.id);
    }
  });

  it('returns an empty collection when the organization has no teams', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('rejects unauthenticated list requests', async () => {
    const app = createApp();

    const response = await request(app).get('/api/teams');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects representative role for team list access', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });

    const response = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('never returns teams from another organization in the list response', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const other = await seedAuthenticatedUser({ role: 'admin' });
    await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Inside Team',
    });
    await createTeamRecord({
      organizationId: other.organization.id,
      name: 'Outside Team',
    });

    const response = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Inside Team');
  });

  it('returns team detail including members for a team in the authenticated organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'North Team',
    });
    const userA = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-a.${Date.now()}@example.com`,
      firstName: 'Ana',
      lastName: 'Able',
      role: 'rep',
    });
    const userB = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-b.${Date.now()}@example.com`,
      firstName: 'Blake',
      lastName: 'Baker',
      role: 'manager',
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: userA.id,
    });
    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: userB.id,
    });

    const response = await request(app)
      .get(`/api/teams/${team.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(team.id);
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.name).toBe('North Team');
    expect(response.body.members).toHaveLength(2);
    expect(response.body.members.map((member) => member.email)).toEqual([
      userA.email,
      userB.email,
    ]);
  });

  it('returns an empty members array when a team has no members', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Empty Team',
    });

    const response = await request(app)
      .get(`/api/teams/${team.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body.members).toEqual([]);
  });

  it('cannot access a team from another organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const other = await seedAuthenticatedUser({ role: 'admin' });
    const outsideTeam = await createTeamRecord({
      organizationId: other.organization.id,
      name: 'Outside Team',
    });

    const response = await request(app)
      .get(`/api/teams/${outsideTeam.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 404 for a nonexistent team in the authenticated organization scope', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .get('/api/teams/2f433953-d5ec-466a-ba42-6252e27f3ad0')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('validates malformed team id requests', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .get('/api/teams/not-a-uuid')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
