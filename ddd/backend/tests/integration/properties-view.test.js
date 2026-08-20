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

async function hasPropertySchema() {
  const result = await query(`
    SELECT
      to_regclass('public.organizations') AS organizations_table,
      to_regclass('public.organization_settings') AS settings_table,
      to_regclass('public.users') AS users_table,
      to_regclass('public.teams') AS teams_table,
      to_regclass('public.team_users') AS team_users_table,
      to_regclass('public.properties') AS properties_table,
      to_regclass('public.statuses') AS statuses_table,
      to_regclass('public.interactions') AS interactions_table
  `);

  const row = result.rows[0];
  return Boolean(
    row.organizations_table &&
    row.settings_table &&
    row.users_table &&
    row.teams_table &&
    row.team_users_table &&
    row.properties_table &&
    row.statuses_table &&
    row.interactions_table,
  );
}

async function ensurePropertySchemaReady() {
  if (await hasPropertySchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasPropertySchema())) {
      throw error;
    }
  }
}

async function createOrganization({
  name = `Org ${Date.now()}-${Math.random()}`,
  repVisibility = 'own',
}) {
  const orgResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
    [name],
  );

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, $2, 'UTC')`,
    [orgResult.rows[0].id, repVisibility],
  );

  return orgResult.rows[0];
}

async function createUser({ organizationId, role = 'rep', label = 'user' }) {
  const email = `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id, organization_id, role, email`,
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

async function createStatus({ organizationId, name = 'No Answer' }) {
  const result = await query(
    `INSERT INTO statuses (organization_id, name, description, display_order, is_active)
     VALUES ($1, $2, NULL, 1, true)
     RETURNING id, name`,
    [organizationId, name],
  );

  return result.rows[0];
}

async function createProperty({
  organizationId,
  addressLine1 = '123 Main St',
  city = 'Knoxville',
  state = 'TN',
  postalCode = '37901',
  country = 'US',
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
    VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, organization_id, address_line_1, city, state, postal_code, country, latitude, longitude`,
    [
      organizationId,
      addressLine1,
      city,
      state,
      postalCode,
      country,
      normalizedAddress,
      latitude,
      longitude,
    ],
  );

  return result.rows[0];
}

async function createInteractionSnapshot({
  organizationId,
  propertyId,
  userId,
  statusId,
  statusName,
  interactionGroupId,
  initialInteractionAt,
  changedAt,
  isCurrent,
  notes,
}) {
  await query(
    `INSERT INTO interactions (
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
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $4,
      $9,
      'Pat Contact',
      '555-555-5555',
      'pat@example.com',
      $10,
      NULL
    )`,
    [
      interactionGroupId,
      propertyId,
      organizationId,
      userId,
      statusId,
      statusName,
      initialInteractionAt,
      changedAt,
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

describeDb('Property detail and current interactions endpoints', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensurePropertySchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('GET /api/properties/:id returns property details for authorized organization', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const user = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'actor',
    });

    const property = await createProperty({
      organizationId: organization.id,
      addressLine1: '2400 Summit Hill Dr',
      city: 'Knoxville',
      state: 'TN',
      postalCode: '37902',
      country: 'US',
      latitude: 35.964,
      longitude: -83.921,
    });

    const response = await request(app)
      .get(`/api/properties/${property.id}`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      propertyId: property.id,
      addressLine1: '2400 Summit Hill Dr',
      addressLine2: null,
      city: 'Knoxville',
      state: 'TN',
      postalCode: '37902',
      country: 'US',
      latitude: 35.964,
      longitude: -83.921,
    });
  });

  it('GET /api/properties/:id enforces organization isolation', async () => {
    const orgA = await createOrganization({ name: 'Org A' });
    const orgB = await createOrganization({ name: 'Org B' });
    const userB = await createUser({
      organizationId: orgB.id,
      role: 'rep',
      label: 'b',
    });

    const propertyA = await createProperty({ organizationId: orgA.id });

    const response = await request(app)
      .get(`/api/properties/${propertyA.id}`)
      .set('Authorization', `Bearer ${tokenFor(userB)}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET /api/properties/:id validates the property id format', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const user = await createUser({ organizationId: organization.id });

    const response = await request(app)
      .get('/api/properties/not-a-uuid')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/properties/:propertyId/interactions returns current snapshots only', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const user = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'actor',
    });
    const status = await createStatus({ organizationId: organization.id });
    const property = await createProperty({ organizationId: organization.id });

    const groupId = '00000000-0000-0000-0000-000000000101';

    await createInteractionSnapshot({
      organizationId: organization.id,
      propertyId: property.id,
      userId: user.id,
      statusId: status.id,
      statusName: status.name,
      interactionGroupId: groupId,
      initialInteractionAt: '2026-08-08T15:30:00.000Z',
      changedAt: '2026-08-08T15:30:00.000Z',
      isCurrent: false,
      notes: 'Older snapshot',
    });

    await createInteractionSnapshot({
      organizationId: organization.id,
      propertyId: property.id,
      userId: user.id,
      statusId: status.id,
      statusName: 'Interested',
      interactionGroupId: groupId,
      initialInteractionAt: '2026-08-08T15:30:00.000Z',
      changedAt: '2026-08-08T15:35:00.000Z',
      isCurrent: true,
      notes: 'Current snapshot',
    });

    const response = await request(app)
      .get(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(response.status).toBe(200);
    expect(response.body.propertyId).toBe(property.id);
    expect(response.body.interactions).toHaveLength(1);
    expect(response.body.interactions[0]).toMatchObject({
      interactionGroupId: groupId,
      userId: user.id,
      statusId: status.id,
      statusName: 'Interested',
      contactName: 'Pat Contact',
      contactPhone: '555-555-5555',
      contactEmail: 'pat@example.com',
      notes: 'Current snapshot',
    });
    expect(response.body.interactions[0].initialInteractionAt).toEqual(
      expect.any(String),
    );
    expect(response.body.interactions[0].changedAt).toEqual(expect.any(String));
  });

  it('GET /api/properties/:propertyId/interactions applies team visibility rules', async () => {
    const organization = await createOrganization({ repVisibility: 'team' });
    const actor = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'actor',
    });
    const teammate = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'teammate',
    });
    const outsider = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'outsider',
    });

    const team = await createTeam({
      organizationId: organization.id,
      name: 'Neighborhood Team',
    });

    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: actor.id,
    });
    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: teammate.id,
    });

    const status = await createStatus({ organizationId: organization.id });
    const property = await createProperty({ organizationId: organization.id });

    await createInteractionSnapshot({
      organizationId: organization.id,
      propertyId: property.id,
      userId: teammate.id,
      statusId: status.id,
      statusName: 'Interested',
      interactionGroupId: '00000000-0000-0000-0000-000000000201',
      initialInteractionAt: '2026-08-08T15:30:00.000Z',
      changedAt: '2026-08-08T15:35:00.000Z',
      isCurrent: true,
      notes: 'Visible teammate note',
    });

    await createInteractionSnapshot({
      organizationId: organization.id,
      propertyId: property.id,
      userId: outsider.id,
      statusId: status.id,
      statusName: 'No Answer',
      interactionGroupId: '00000000-0000-0000-0000-000000000202',
      initialInteractionAt: '2026-08-08T15:40:00.000Z',
      changedAt: '2026-08-08T15:45:00.000Z',
      isCurrent: true,
      notes: 'Hidden outsider note',
    });

    const response = await request(app)
      .get(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(actor)}`);

    expect(response.status).toBe(200);
    expect(response.body.interactions).toHaveLength(1);
    expect(response.body.interactions[0].userId).toBe(teammate.id);
    expect(response.body.interactions[0].notes).toBe('Visible teammate note');
  });

  it('GET /api/properties/:propertyId/interactions returns not found for cross-organization property', async () => {
    const orgA = await createOrganization({ name: 'Org A' });
    const orgB = await createOrganization({ name: 'Org B' });
    const userB = await createUser({
      organizationId: orgB.id,
      role: 'rep',
      label: 'user-b',
    });

    const propertyA = await createProperty({ organizationId: orgA.id });

    const response = await request(app)
      .get(`/api/properties/${propertyA.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(userB)}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET /api/properties/:propertyId/interactions validates the property id format', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const user = await createUser({ organizationId: organization.id });

    const response = await request(app)
      .get('/api/properties/not-a-uuid/interactions')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication for property detail and interaction endpoints', async () => {
    const responseDetail = await request(app).get(
      '/api/properties/00000000-0000-0000-0000-000000000001',
    );

    expect(responseDetail.status).toBe(401);
    expect(responseDetail.body.error.code).toBe('UNAUTHENTICATED');

    const responseInteractions = await request(app).get(
      '/api/properties/00000000-0000-0000-0000-000000000001/interactions',
    );

    expect(responseInteractions.status).toBe(401);
    expect(responseInteractions.body.error.code).toBe('UNAUTHENTICATED');
  });
});
