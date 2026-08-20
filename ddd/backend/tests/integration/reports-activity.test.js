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

async function hasReportSchema() {
  const result = await query(`
    SELECT
      to_regclass('public.organizations') AS organizations_table,
      to_regclass('public.organization_settings') AS settings_table,
      to_regclass('public.users') AS users_table,
      to_regclass('public.teams') AS teams_table,
      to_regclass('public.team_users') AS team_users_table,
      to_regclass('public.statuses') AS statuses_table,
      to_regclass('public.properties') AS properties_table,
      to_regclass('public.interactions') AS interactions_table
  `);

  const row = result.rows[0];

  return Boolean(
    row.organizations_table &&
    row.settings_table &&
    row.users_table &&
    row.teams_table &&
    row.team_users_table &&
    row.statuses_table &&
    row.properties_table &&
    row.interactions_table,
  );
}

async function ensureReportSchemaReady() {
  if (await hasReportSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasReportSchema())) {
      throw error;
    }
  }
}

async function createOrganization({
  name = `Org ${Date.now()}-${Math.random()}`,
  repVisibility = 'own',
  timezone = 'UTC',
}) {
  const organizationResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
    [name],
  );

  const organization = organizationResult.rows[0];

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, $2, $3)`,
    [organization.id, repVisibility, timezone],
  );

  return organization;
}

async function createUser({ organizationId, role = 'rep', label = 'user' }) {
  const email = `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id, organization_id, role, email, first_name, last_name`,
    [
      organizationId,
      email.toLowerCase(),
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      label,
      'User',
      role,
    ],
  );

  return result.rows[0];
}

async function createTeam({ organizationId, name = 'Team' }) {
  const result = await query(
    `INSERT INTO teams (organization_id, name)
     VALUES ($1, $2)
     RETURNING id`,
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

async function createStatus({
  organizationId,
  name = 'No Answer',
  displayOrder = 1,
}) {
  const result = await query(
    `INSERT INTO statuses (organization_id, name, description, display_order, is_active)
     VALUES ($1, $2, NULL, $3, true)
     RETURNING id, name`,
    [organizationId, name, displayOrder],
  );

  return result.rows[0];
}

async function createProperty({
  organizationId,
  latitude = 35.5,
  longitude = -84.1,
  normalizedAddress = `normalized-${Date.now()}-${Math.random()}`,
}) {
  const result = await query(
    `INSERT INTO properties (
      organization_id,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      country,
      normalized_address,
      latitude,
      longitude
    )
    VALUES ($1, '123 Main St', NULL, 'Knoxville', 'TN', '37901', 'US', $2, $3, $4)
    RETURNING id`,
    [organizationId, normalizedAddress, latitude, longitude],
  );

  return result.rows[0];
}

async function createInteractionSnapshot({
  id,
  interactionGroupId,
  propertyId,
  organizationId,
  userId,
  statusId,
  statusName,
  initialInteractionAt,
  changedAt,
  changedBy,
  isCurrent,
  notes = null,
}) {
  await query(
    `INSERT INTO interactions (
      id,
      interaction_group_id,
      property_id,
      organization_id,
      user_id,
      status_id,
      status_name,
      initial_interaction_at,
      changed_at,
      changed_by,
      is_current,
      contact_name,
      contact_phone,
      contact_email,
      notes,
      client_request_id
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      NULL,
      NULL,
      NULL,
      $12,
      NULL
    )`,
    [
      id,
      interactionGroupId,
      propertyId,
      organizationId,
      userId,
      statusId,
      statusName,
      initialInteractionAt,
      changedAt,
      changedBy,
      isCurrent,
      notes,
    ],
  );
}

function tokenFor(user) {
  return signAccessToken({
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role,
  });
}

describeDb('GET /api/reports/activity', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureReportSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('returns grouped activity for authorized manager with team filter and knock semantics', async () => {
    const organization = await createOrganization({
      repVisibility: 'own',
      timezone: 'UTC',
    });
    const manager = await createUser({
      organizationId: organization.id,
      role: 'manager',
      label: 'manager',
    });
    const repA = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep-a',
    });
    const repB = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep-b',
    });

    const team = await createTeam({
      organizationId: organization.id,
      name: 'Alpha Team',
    });

    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: manager.id,
    });
    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: repA.id,
    });

    const statusA = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
      displayOrder: 1,
    });
    const statusB = await createStatus({
      organizationId: organization.id,
      name: 'Interested',
      displayOrder: 2,
    });

    const propertyA = await createProperty({ organizationId: organization.id });
    const propertyB = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'property-b',
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000aa',
      interactionGroupId: '11111111-1111-4111-8111-111111111111',
      propertyId: propertyA.id,
      organizationId: organization.id,
      userId: repA.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: '2026-08-02T10:00:00.000Z',
      changedBy: repA.id,
      isCurrent: false,
      notes: 'Initial rep A',
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000ab',
      interactionGroupId: '11111111-1111-4111-8111-111111111111',
      propertyId: propertyA.id,
      organizationId: organization.id,
      userId: repA.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: '2026-08-03T10:00:00.000Z',
      changedBy: repA.id,
      isCurrent: true,
      notes: 'Updated rep A',
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000ba',
      interactionGroupId: '22222222-2222-4222-8222-222222222222',
      propertyId: propertyB.id,
      organizationId: organization.id,
      userId: repB.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-02T12:00:00.000Z',
      changedAt: '2026-08-02T12:00:00.000Z',
      changedBy: repB.id,
      isCurrent: true,
      notes: 'Rep B current',
    });

    const response = await request(app)
      .get(
        `/api/reports/activity?dateFrom=2026-08-01&dateTo=2026-08-03&teamId=${team.id}`,
      )
      .set('Authorization', `Bearer ${tokenFor(manager)}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalKnocks).toBe(1);
    expect(response.body.byRepresentative).toHaveLength(1);
    expect(response.body.byRepresentative[0].userId).toBe(repA.id);
    expect(response.body.byRepresentative[0].knocks).toBe(1);
    expect(response.body.byStatus).toEqual([
      {
        statusId: statusB.id,
        statusName: statusB.name,
        knocks: 1,
      },
    ]);
  });

  it('supports status and representative filters for admin requests', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
      timezone: 'UTC',
    });
    const admin = await createUser({
      organizationId: organization.id,
      role: 'admin',
      label: 'admin',
    });
    const repA = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep-a',
    });
    const repB = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep-b',
    });
    const statusA = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
      displayOrder: 1,
    });
    const statusB = await createStatus({
      organizationId: organization.id,
      name: 'Interested',
      displayOrder: 2,
    });

    const propertyA = await createProperty({ organizationId: organization.id });
    const propertyB = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'property-b',
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000ca',
      interactionGroupId: '33333333-3333-4333-8333-333333333333',
      propertyId: propertyA.id,
      organizationId: organization.id,
      userId: repA.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-02T09:00:00.000Z',
      changedAt: '2026-08-02T09:00:00.000Z',
      changedBy: repA.id,
      isCurrent: true,
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000cb',
      interactionGroupId: '44444444-4444-4444-8444-444444444444',
      propertyId: propertyB.id,
      organizationId: organization.id,
      userId: repB.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-02T11:00:00.000Z',
      changedAt: '2026-08-02T11:00:00.000Z',
      changedBy: repB.id,
      isCurrent: true,
    });

    const response = await request(app)
      .get(
        `/api/reports/activity?dateFrom=2026-08-01&dateTo=2026-08-03&statusId=${statusB.id}&userId=${repB.id}`,
      )
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalKnocks).toBe(1);
    expect(response.body.byStatus).toEqual([
      {
        statusId: statusB.id,
        statusName: statusB.name,
        knocks: 1,
      },
    ]);
    expect(response.body.byRepresentative).toEqual([
      {
        userId: repB.id,
        firstName: repB.first_name,
        lastName: repB.last_name,
        email: repB.email,
        knocks: 1,
      },
    ]);
  });

  it('uses deterministic changed_at and id tie-break for status grouping and does not double-count revisions', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
      timezone: 'UTC',
    });
    const admin = await createUser({
      organizationId: organization.id,
      role: 'admin',
      label: 'admin',
    });
    const rep = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep',
    });
    const statusA = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
      displayOrder: 1,
    });
    const statusB = await createStatus({
      organizationId: organization.id,
      name: 'Interested',
      displayOrder: 2,
    });
    const property = await createProperty({ organizationId: organization.id });

    const sameChangedAt = '2026-08-02T15:00:00.000Z';

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-000000000001',
      interactionGroupId: '55555555-5555-4555-8555-555555555555',
      propertyId: property.id,
      organizationId: organization.id,
      userId: rep.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: sameChangedAt,
      changedBy: rep.id,
      isCurrent: false,
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-00000000000f',
      interactionGroupId: '55555555-5555-4555-8555-555555555555',
      propertyId: property.id,
      organizationId: organization.id,
      userId: rep.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: sameChangedAt,
      changedBy: rep.id,
      isCurrent: true,
    });

    const response = await request(app)
      .get('/api/reports/activity?dateFrom=2026-08-02&dateTo=2026-08-02')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalKnocks).toBe(1);
    expect(response.body.byRepresentative).toHaveLength(1);
    expect(response.body.byRepresentative[0].knocks).toBe(1);
    expect(response.body.byStatus).toEqual([
      {
        statusId: statusB.id,
        statusName: statusB.name,
        knocks: 1,
      },
    ]);
  });

  it('interprets inclusive date range using organization timezone boundaries', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
      timezone: 'America/New_York',
    });
    const admin = await createUser({
      organizationId: organization.id,
      role: 'admin',
      label: 'admin',
    });
    const rep = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep',
    });
    const status = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
      displayOrder: 1,
    });
    const propertyA = await createProperty({ organizationId: organization.id });
    const propertyB = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'property-b',
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000da',
      interactionGroupId: '66666666-6666-4666-8666-666666666666',
      propertyId: propertyA.id,
      organizationId: organization.id,
      userId: rep.id,
      statusId: status.id,
      statusName: status.name,
      initialInteractionAt: '2026-08-02T03:30:00.000Z',
      changedAt: '2026-08-02T03:30:00.000Z',
      changedBy: rep.id,
      isCurrent: true,
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000db',
      interactionGroupId: '77777777-7777-4777-8777-777777777777',
      propertyId: propertyB.id,
      organizationId: organization.id,
      userId: rep.id,
      statusId: status.id,
      statusName: status.name,
      initialInteractionAt: '2026-08-02T04:30:00.000Z',
      changedAt: '2026-08-02T04:30:00.000Z',
      changedBy: rep.id,
      isCurrent: true,
    });

    const response = await request(app)
      .get('/api/reports/activity?dateFrom=2026-08-01&dateTo=2026-08-01')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalKnocks).toBe(1);
    expect(response.body.byRepresentative).toHaveLength(1);
    expect(response.body.byRepresentative[0].knocks).toBe(1);
  });

  it('enforces authentication and role authorization', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
      timezone: 'UTC',
    });
    const rep = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep',
    });

    const unauthenticated = await request(app).get(
      '/api/reports/activity?dateFrom=2026-08-01&dateTo=2026-08-02',
    );

    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const forbidden = await request(app)
      .get('/api/reports/activity?dateFrom=2026-08-01&dateTo=2026-08-02')
      .set('Authorization', `Bearer ${tokenFor(rep)}`);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid query validation and preserves organization isolation', async () => {
    const organizationA = await createOrganization({
      repVisibility: 'organization',
      timezone: 'UTC',
    });
    const organizationB = await createOrganization({
      repVisibility: 'organization',
      timezone: 'UTC',
    });
    const adminA = await createUser({
      organizationId: organizationA.id,
      role: 'admin',
      label: 'admin-a',
    });
    const repB = await createUser({
      organizationId: organizationB.id,
      role: 'rep',
      label: 'rep-b',
    });
    const statusB = await createStatus({
      organizationId: organizationB.id,
      name: 'Interested',
    });
    const propertyB = await createProperty({
      organizationId: organizationB.id,
    });

    await createInteractionSnapshot({
      id: '00000000-0000-4000-8000-0000000000ea',
      interactionGroupId: '88888888-8888-4888-8888-888888888888',
      propertyId: propertyB.id,
      organizationId: organizationB.id,
      userId: repB.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: '2026-08-02T10:00:00.000Z',
      changedBy: repB.id,
      isCurrent: true,
    });

    const invalidQuery = await request(app)
      .get('/api/reports/activity?dateFrom=2026-08-10&dateTo=2026-08-01')
      .set('Authorization', `Bearer ${tokenFor(adminA)}`);

    expect(invalidQuery.status).toBe(400);
    expect(invalidQuery.body.error.code).toBe('VALIDATION_ERROR');

    const isolated = await request(app)
      .get('/api/reports/activity?dateFrom=2026-08-01&dateTo=2026-08-03')
      .set('Authorization', `Bearer ${tokenFor(adminA)}`);

    expect(isolated.status).toBe(200);
    expect(isolated.body.summary.totalKnocks).toBe(0);
    expect(isolated.body.byStatus).toEqual([]);
    expect(isolated.body.byRepresentative).toEqual([]);
  });
});
