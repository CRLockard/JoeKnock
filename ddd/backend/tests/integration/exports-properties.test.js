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

async function hasExportSchema() {
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

async function ensureExportSchemaReady() {
  if (await hasExportSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasExportSchema())) {
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
  addressLine1 = '123 Main St',
  city = 'Knoxville',
  state = 'TN',
  postalCode = '37901',
  normalizedAddress = `normalized-${Date.now()}-${Math.random()}`,
  latitude = 35.5,
  longitude = -84.1,
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
    VALUES ($1, $2, NULL, $3, $4, $5, 'US', $6, $7, $8)
    RETURNING id`,
    [
      organizationId,
      addressLine1,
      city,
      state,
      postalCode,
      normalizedAddress,
      latitude,
      longitude,
    ],
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
  contactName = null,
  contactPhone = null,
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
      $12,
      $13,
      NULL,
      $14,
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
      contactName,
      contactPhone,
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

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = '';
  let isQuoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (isQuoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      isQuoted = true;
      continue;
    }

    if (char === ',') {
      row.push(value);
      value = '';
      continue;
    }

    if (char === '\r' && next === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      i += 1;
      continue;
    }

    if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

describeDb('GET /api/exports/properties', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureExportSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('exports CSV for authorized manager with expected headers and filter parity', async () => {
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
      name: 'Alpha',
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

    const propertyA = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'prop-a',
    });
    const propertyB = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'prop-b',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000001',
      interactionGroupId: '21111111-1111-4111-8111-111111111111',
      propertyId: propertyA.id,
      organizationId: organization.id,
      userId: repA.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-01T10:00:00.000Z',
      changedAt: '2026-08-01T10:00:00.000Z',
      changedBy: repA.id,
      isCurrent: false,
      contactName: 'Ann A',
      contactPhone: '555-1000',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000002',
      interactionGroupId: '21111111-1111-4111-8111-111111111111',
      propertyId: propertyA.id,
      organizationId: organization.id,
      userId: repA.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-01T10:00:00.000Z',
      changedAt: '2026-08-02T12:00:00.000Z',
      changedBy: repA.id,
      isCurrent: true,
      contactName: 'Ann A',
      contactPhone: '555-1000',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000003',
      interactionGroupId: '22222222-2222-4222-8222-222222222222',
      propertyId: propertyB.id,
      organizationId: organization.id,
      userId: repB.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-01T11:00:00.000Z',
      changedAt: '2026-08-01T11:00:00.000Z',
      changedBy: repB.id,
      isCurrent: true,
      contactName: 'Bob B',
      contactPhone: '555-2000',
    });

    const response = await request(app)
      .get(
        `/api/exports/properties?dateFrom=2026-08-01&dateTo=2026-08-02&teamId=${team.id}`,
      )
      .set('Authorization', `Bearer ${tokenFor(manager)}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain(
      'attachment; filename=',
    );

    const parsed = parseCsv(response.text);

    expect(parsed[0]).toEqual([
      'address',
      'contactName',
      'phone',
      'currentStatus',
      'representative',
      'interactionDate',
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[1][1]).toBe('Ann A');
    expect(parsed[1][2]).toBe('555-1000');
    expect(parsed[1][3]).toBe('Interested');
    expect(parsed[1][4]).toContain('rep-a');
  });

  it('exports CSV for authorized admin and enforces status/representative filters', async () => {
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

    const propertyA = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'prop-a',
    });
    const propertyB = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'prop-b',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000011',
      interactionGroupId: '23333333-3333-4333-8333-333333333333',
      propertyId: propertyA.id,
      organizationId: organization.id,
      userId: repA.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-02T09:00:00.000Z',
      changedAt: '2026-08-02T09:00:00.000Z',
      changedBy: repA.id,
      isCurrent: true,
      contactName: 'Alice',
      contactPhone: '555-3000',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000012',
      interactionGroupId: '24444444-4444-4444-8444-444444444444',
      propertyId: propertyB.id,
      organizationId: organization.id,
      userId: repB.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: '2026-08-02T10:00:00.000Z',
      changedBy: repB.id,
      isCurrent: true,
      contactName: 'Betty',
      contactPhone: '555-4000',
    });

    const response = await request(app)
      .get(
        `/api/exports/properties?dateFrom=2026-08-01&dateTo=2026-08-03&statusId=${statusB.id}&userId=${repB.id}`,
      )
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(200);
    const parsed = parseCsv(response.text);
    expect(parsed).toHaveLength(2);
    expect(parsed[1][1]).toBe('Betty');
    expect(parsed[1][3]).toBe('Interested');
    expect(parsed[1][4]).toContain('rep-b');
  });

  it('rejects missing auth and rep role', async () => {
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
      '/api/exports/properties?dateFrom=2026-08-01&dateTo=2026-08-01',
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const forbidden = await request(app)
      .get('/api/exports/properties?dateFrom=2026-08-01&dateTo=2026-08-01')
      .set('Authorization', `Bearer ${tokenFor(rep)}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('returns validation errors for invalid query parameters', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
      timezone: 'UTC',
    });
    const admin = await createUser({
      organizationId: organization.id,
      role: 'admin',
      label: 'admin',
    });

    const invalid = await request(app)
      .get('/api/exports/properties?dateFrom=2026-08-10&dateTo=2026-08-01')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies organization-local timezone boundaries and excludes cross-organization data', async () => {
    const organizationA = await createOrganization({
      repVisibility: 'organization',
      timezone: 'America/New_York',
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
    const repA = await createUser({
      organizationId: organizationA.id,
      role: 'rep',
      label: 'rep-a',
    });
    const repB = await createUser({
      organizationId: organizationB.id,
      role: 'rep',
      label: 'rep-b',
    });
    const statusA = await createStatus({
      organizationId: organizationA.id,
      name: 'No Answer',
      displayOrder: 1,
    });
    const statusB = await createStatus({
      organizationId: organizationB.id,
      name: 'No Answer',
      displayOrder: 1,
    });

    const propertyA1 = await createProperty({
      organizationId: organizationA.id,
      normalizedAddress: 'a-1',
    });
    const propertyA2 = await createProperty({
      organizationId: organizationA.id,
      normalizedAddress: 'a-2',
    });
    const propertyB = await createProperty({
      organizationId: organizationB.id,
      normalizedAddress: 'b-1',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000021',
      interactionGroupId: '25555555-5555-4555-8555-555555555555',
      propertyId: propertyA1.id,
      organizationId: organizationA.id,
      userId: repA.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-01T03:30:00.000Z',
      changedAt: '2026-08-01T03:30:00.000Z',
      changedBy: repA.id,
      isCurrent: true,
      contactName: 'Outside Boundary',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000022',
      interactionGroupId: '26666666-6666-4666-8666-666666666666',
      propertyId: propertyA2.id,
      organizationId: organizationA.id,
      userId: repA.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-01T04:30:00.000Z',
      changedAt: '2026-08-01T04:30:00.000Z',
      changedBy: repA.id,
      isCurrent: true,
      contactName: 'Inside Boundary',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000023',
      interactionGroupId: '27777777-7777-4777-8777-777777777777',
      propertyId: propertyB.id,
      organizationId: organizationB.id,
      userId: repB.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-01T12:00:00.000Z',
      changedAt: '2026-08-01T12:00:00.000Z',
      changedBy: repB.id,
      isCurrent: true,
      contactName: 'Other Organization',
    });

    const response = await request(app)
      .get('/api/exports/properties?dateFrom=2026-08-01&dateTo=2026-08-01')
      .set('Authorization', `Bearer ${tokenFor(adminA)}`);

    expect(response.status).toBe(200);
    const parsed = parseCsv(response.text);
    expect(parsed).toHaveLength(2);
    expect(parsed[1][1]).toBe('Inside Boundary');
  });

  it('uses deterministic latest snapshot selection and does not duplicate revisions', async () => {
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
    const property = await createProperty({
      organizationId: organization.id,
      normalizedAddress: 'prop-a',
    });

    const sameChangedAt = '2026-08-02T15:00:00.000Z';

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000031',
      interactionGroupId: '28888888-8888-4888-8888-888888888888',
      propertyId: property.id,
      organizationId: organization.id,
      userId: rep.id,
      statusId: statusA.id,
      statusName: statusA.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: sameChangedAt,
      changedBy: rep.id,
      isCurrent: false,
      contactName: 'Original Name',
      contactPhone: '555-7000',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-00000000003f',
      interactionGroupId: '28888888-8888-4888-8888-888888888888',
      propertyId: property.id,
      organizationId: organization.id,
      userId: rep.id,
      statusId: statusB.id,
      statusName: statusB.name,
      initialInteractionAt: '2026-08-02T10:00:00.000Z',
      changedAt: sameChangedAt,
      changedBy: rep.id,
      isCurrent: true,
      contactName: 'Revised Name',
      contactPhone: '555-8000',
    });

    const response = await request(app)
      .get('/api/exports/properties?dateFrom=2026-08-02&dateTo=2026-08-02')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(200);
    const parsed = parseCsv(response.text);
    expect(parsed).toHaveLength(2);
    expect(parsed[1][1]).toBe('Revised Name');
    expect(parsed[1][2]).toBe('555-8000');
    expect(parsed[1][3]).toBe('Interested');
  });

  it('escapes CSV commas, quotes, and newlines correctly', async () => {
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
    const status = await createStatus({
      organizationId: organization.id,
      name: 'Quoted "Status"',
      displayOrder: 1,
    });
    const property = await createProperty({
      organizationId: organization.id,
      addressLine1: '123 "Main", Suite 2',
      normalizedAddress: 'quoted-address',
    });

    await createInteractionSnapshot({
      id: '20000000-0000-4000-8000-000000000041',
      interactionGroupId: '29999999-9999-4999-8999-999999999999',
      propertyId: property.id,
      organizationId: organization.id,
      userId: rep.id,
      statusId: status.id,
      statusName: status.name,
      initialInteractionAt: '2026-08-01T10:00:00.000Z',
      changedAt: '2026-08-01T10:00:00.000Z',
      changedBy: rep.id,
      isCurrent: true,
      contactName: 'Last, "First"\nHomeowner',
      contactPhone: '555-9000',
    });

    const response = await request(app)
      .get('/api/exports/properties?dateFrom=2026-08-01&dateTo=2026-08-01')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('"123 ""Main"", Suite 2');
    expect(response.text).toContain('"Last, ""First""\nHomeowner"');
  });

  it('returns generic 500 error envelope on unexpected export failures', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
      timezone: 'UTC',
    });
    const admin = await createUser({
      organizationId: organization.id,
      role: 'admin',
      label: 'admin',
    });

    const failingApp = createApp({
      exportsService: {
        async exportPropertiesCsv() {
          throw new Error('internal details should not leak');
        },
      },
    });

    const response = await request(failingApp)
      .get('/api/exports/properties?dateFrom=2026-08-01&dateTo=2026-08-01')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body.error.message).toBe('An unexpected error occurred.');
  });
});
