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
      to_regclass('public.team_users') AS team_users_table,
      to_regclass('public.interactions') AS interactions_table
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
  email = `team-remove.${Date.now()}@example.com`,
  organizationName = `Teams Remove Org ${Date.now()}-${Math.random()}`,
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

async function addUserToTeam({ organizationId, teamId, userId }) {
  await query(
    `INSERT INTO team_users (organization_id, team_id, user_id)
     VALUES ($1, $2, $3)`,
    [organizationId, teamId, userId],
  );
}

async function getInteractionCount() {
  const tableResult = await query(
    `SELECT to_regclass('public.interactions') AS interactions_table`,
  );

  if (!tableResult.rows[0].interactions_table) {
    return 0;
  }

  const countResult = await query(
    'SELECT COUNT(*)::int AS count FROM interactions',
  );
  return countResult.rows[0].count;
}

describeDb('DELETE /api/teams/:id/users/:userId', () => {
  beforeAll(async () => {
    await ensureTeamMembershipSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('allows a manager to remove a team membership', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'North Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-mgr-remove.${Date.now()}@example.com`,
      firstName: 'Ana',
      lastName: 'Able',
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: member.id,
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${member.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.teamId).toBe(team.id);
    expect(response.body.userId).toBe(member.id);

    const membershipRows = await query(
      'SELECT * FROM team_users WHERE team_id = $1 AND user_id = $2',
      [team.id, member.id],
    );

    expect(membershipRows.rows).toHaveLength(0);
  });

  it('allows an admin to remove a team membership', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'South Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-admin-remove.${Date.now()}@example.com`,
      firstName: 'Ben',
      lastName: 'Baker',
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: member.id,
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${member.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body.teamId).toBe(team.id);
    expect(response.body.userId).toBe(member.id);
  });

  it('keeps the user account existing and active after membership removal', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'User Integrity Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-integrity.${Date.now()}@example.com`,
      firstName: 'Casey',
      lastName: 'Clark',
      isActive: true,
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: member.id,
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${member.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);

    const usersResult = await query(
      'SELECT id, is_active FROM users WHERE id = $1 AND organization_id = $2',
      [member.id, actor.organization.id],
    );

    expect(usersResult.rows).toHaveLength(1);
    expect(usersResult.rows[0].is_active).toBe(true);
  });

  it('preserves other memberships for the same user', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const teamA = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Team A',
    });
    const teamB = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Team B',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-multi.${Date.now()}@example.com`,
      firstName: 'Drew',
      lastName: 'Diaz',
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: teamA.id,
      userId: member.id,
    });
    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: teamB.id,
      userId: member.id,
    });

    const response = await request(app)
      .delete(`/api/teams/${teamA.id}/users/${member.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);

    const membershipRows = await query(
      'SELECT team_id FROM team_users WHERE user_id = $1 AND organization_id = $2 ORDER BY team_id ASC',
      [member.id, actor.organization.id],
    );

    expect(membershipRows.rows).toHaveLength(1);
    expect(membershipRows.rows[0].team_id).toBe(teamB.id);
  });

  it('preserves other members on the same team', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Shared Team',
    });
    const memberA = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-a-remove.${Date.now()}@example.com`,
      firstName: 'Evan',
      lastName: 'Edwards',
    });
    const memberB = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-b-remove.${Date.now()}@example.com`,
      firstName: 'Finn',
      lastName: 'Ford',
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: memberA.id,
    });
    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: memberB.id,
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${memberA.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);

    const membershipRows = await query(
      'SELECT user_id FROM team_users WHERE team_id = $1 ORDER BY user_id ASC',
      [team.id],
    );

    expect(membershipRows.rows).toHaveLength(1);
    expect(membershipRows.rows[0].user_id).toBe(memberB.id);
  });

  it('does not change interaction history row counts', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'History Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-history.${Date.now()}@example.com`,
      firstName: 'Gray',
      lastName: 'Green',
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: member.id,
    });

    const beforeCount = await getInteractionCount();

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${member.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);

    const afterCount = await getInteractionCount();
    expect(afterCount).toBe(beforeCount);
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app).delete(
      '/api/teams/2f433953-d5ec-466a-ba42-6252e27f3ad0/users/8d3be711-07b6-4f76-bb06-ef2f0b5547f7',
    );

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
      email: `member-role-remove.${Date.now()}@example.com`,
      firstName: 'Harper',
      lastName: 'Hall',
    });

    await addUserToTeam({
      organizationId: actor.organization.id,
      teamId: team.id,
      userId: member.id,
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${member.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for nonexistent team in authenticated organization scope', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-no-team-remove.${Date.now()}@example.com`,
      firstName: 'Ira',
      lastName: 'Iverson',
    });

    const response = await request(app)
      .delete(
        `/api/teams/2f433953-d5ec-466a-ba42-6252e27f3ad0/users/${member.id}`,
      )
      .set('Authorization', `Bearer ${actor.token}`);

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
      .delete(
        `/api/teams/${team.id}/users/8d3be711-07b6-4f76-bb06-ef2f0b5547f7`,
      )
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 404 for a user that is not a member of the team', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Missing Membership Team',
    });
    const member = await createUserRecord({
      organizationId: actor.organization.id,
      email: `member-nonmember.${Date.now()}@example.com`,
      firstName: 'Jesse',
      lastName: 'Jones',
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${member.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('validates malformed team id and user id', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    const invalidTeamIdResponse = await request(app)
      .delete(
        '/api/teams/not-a-uuid/users/8d3be711-07b6-4f76-bb06-ef2f0b5547f7',
      )
      .set('Authorization', `Bearer ${actor.token}`);

    expect(invalidTeamIdResponse.status).toBe(400);
    expect(invalidTeamIdResponse.body.error.code).toBe('VALIDATION_ERROR');

    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Validation Team',
    });

    const invalidUserIdResponse = await request(app)
      .delete(`/api/teams/${team.id}/users/not-a-uuid`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(invalidUserIdResponse.status).toBe(400);
    expect(invalidUserIdResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cannot remove from a team in another organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const outsideTeam = await createTeamRecord({
      organizationId: other.organization.id,
      name: 'Outside Team',
    });

    const insideUser = await createUserRecord({
      organizationId: actor.organization.id,
      email: `inside-user-remove.${Date.now()}@example.com`,
      firstName: 'Kai',
      lastName: 'King',
    });

    const response = await request(app)
      .delete(`/api/teams/${outsideTeam.id}/users/${insideUser.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('cannot remove a user from another organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Inside Team',
    });

    const outsideUser = await createUserRecord({
      organizationId: other.organization.id,
      email: `outside-user-remove.${Date.now()}@example.com`,
      firstName: 'Lane',
      lastName: 'Lewis',
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${outsideUser.id}`)
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('ignores client-supplied organization selectors during removal', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const team = await createTeamRecord({
      organizationId: actor.organization.id,
      name: 'Owned Team',
    });

    const outsideUser = await createUserRecord({
      organizationId: other.organization.id,
      email: `outside-selector-remove.${Date.now()}@example.com`,
      firstName: 'Mara',
      lastName: 'Miller',
    });

    const response = await request(app)
      .delete(`/api/teams/${team.id}/users/${outsideUser.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ organizationId: actor.organization.id });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});
