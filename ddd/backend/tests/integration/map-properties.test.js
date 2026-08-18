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

async function hasMapSchema() {
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

async function ensureMapSchemaReady() {
  if (await hasMapSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasMapSchema())) {
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

  const organization = orgResult.rows[0];

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, $2, 'UTC')`,
    [organization.id, repVisibility],
  );

  return organization;
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
  latitude,
  longitude,
  normalizedAddress,
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
    RETURNING id, latitude, longitude`,
    [organizationId, normalizedAddress, latitude, longitude],
  );

  return result.rows[0];
}

async function createCurrentInteraction({
  organizationId,
  propertyId,
  userId,
  changedBy,
  statusId,
  statusName,
  groupLabel,
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
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      now(),
      now(),
      $6,
      true,
      NULL,
      NULL,
      NULL,
      $7,
      NULL
    )`,
    [
      propertyId,
      organizationId,
      userId,
      statusId,
      statusName,
      changedBy,
      `interaction-${groupLabel}`,
    ],
  );
}

function authTokenFor(user, organizationId) {
  return signAccessToken({
    userId: user.id,
    organizationId,
    role: user.role,
  });
}

function getMarkers(app, token, bounds) {
  const params = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
  });

  return request(app)
    .get(`/api/map/properties?${params.toString()}`)
    .set('Authorization', `Bearer ${token}`);
}

describeDb('GET /api/map/properties', () => {
  const app = createApp();
  const bounds = {
    north: 36,
    south: 35,
    east: -83,
    west: -85,
  };

  beforeAll(async () => {
    await ensureMapSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get(
      '/api/map/properties?north=36&south=35&east=-83&west=-85',
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns one marker per property for visible current interactions only', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
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
    const status = await createStatus({ organizationId: organization.id });

    const propertyVisible = await createProperty({
      organizationId: organization.id,
      latitude: 35.5,
      longitude: -84.1,
      normalizedAddress: 'visible-address',
    });

    const propertyHidden = await createProperty({
      organizationId: organization.id,
      latitude: 35.6,
      longitude: -84.2,
      normalizedAddress: 'hidden-address',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: propertyVisible.id,
      userId: actor.id,
      changedBy: actor.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'actor-visible',
    });

    // This second visible interaction for the same property must not create a second pin.
    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: propertyVisible.id,
      userId: teammate.id,
      changedBy: teammate.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'teammate-same-property',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: propertyHidden.id,
      userId: teammate.id,
      changedBy: teammate.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'teammate-only-property',
    });

    const response = await getMarkers(
      app,
      authTokenFor(actor, organization.id),
      bounds,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toEqual({
      propertyId: propertyVisible.id,
      latitude: Number(propertyVisible.latitude),
      longitude: Number(propertyVisible.longitude),
    });
  });

  it('applies team visibility for representatives', async () => {
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
    const status = await createStatus({ organizationId: organization.id });

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

    const teammateProperty = await createProperty({
      organizationId: organization.id,
      latitude: 35.45,
      longitude: -84.05,
      normalizedAddress: 'teammate-address',
    });
    const outsiderProperty = await createProperty({
      organizationId: organization.id,
      latitude: 35.46,
      longitude: -84.06,
      normalizedAddress: 'outsider-address',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: teammateProperty.id,
      userId: teammate.id,
      changedBy: teammate.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'teammate-group',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: outsiderProperty.id,
      userId: outsider.id,
      changedBy: outsider.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'outsider-group',
    });

    const response = await getMarkers(
      app,
      authTokenFor(actor, organization.id),
      bounds,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].propertyId).toBe(teammateProperty.id);
  });

  it('limits managers with own visibility to own plus assigned-team interactions', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const manager = await createUser({
      organizationId: organization.id,
      role: 'manager',
      label: 'manager',
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
      name: 'A',
    });
    const status = await createStatus({ organizationId: organization.id });

    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: manager.id,
    });
    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: teammate.id,
    });

    const managerProperty = await createProperty({
      organizationId: organization.id,
      latitude: 35.51,
      longitude: -84.01,
      normalizedAddress: 'manager-property',
    });
    const teammateProperty = await createProperty({
      organizationId: organization.id,
      latitude: 35.52,
      longitude: -84.02,
      normalizedAddress: 'teammate-property',
    });
    const outsiderProperty = await createProperty({
      organizationId: organization.id,
      latitude: 35.53,
      longitude: -84.03,
      normalizedAddress: 'outsider-property',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: managerProperty.id,
      userId: manager.id,
      changedBy: manager.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'manager',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: teammateProperty.id,
      userId: teammate.id,
      changedBy: teammate.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'teammate',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: outsiderProperty.id,
      userId: outsider.id,
      changedBy: outsider.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'outsider',
    });

    const response = await getMarkers(
      app,
      authTokenFor(manager, organization.id),
      bounds,
    );

    expect(response.status).toBe(200);
    expect(response.body.map((row) => row.propertyId).sort()).toEqual(
      [managerProperty.id, teammateProperty.id].sort(),
    );
  });

  it('returns all current organization markers for organization visibility and admin role', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
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
    const status = await createStatus({ organizationId: organization.id });

    const propertyA = await createProperty({
      organizationId: organization.id,
      latitude: 35.41,
      longitude: -84.11,
      normalizedAddress: 'org-property-a',
    });
    const propertyB = await createProperty({
      organizationId: organization.id,
      latitude: 35.42,
      longitude: -84.12,
      normalizedAddress: 'org-property-b',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: propertyA.id,
      userId: repA.id,
      changedBy: repA.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'org-a',
    });

    await createCurrentInteraction({
      organizationId: organization.id,
      propertyId: propertyB.id,
      userId: repB.id,
      changedBy: repB.id,
      statusId: status.id,
      statusName: status.name,
      groupLabel: 'org-b',
    });

    const response = await getMarkers(
      app,
      authTokenFor(admin, organization.id),
      bounds,
    );

    expect(response.status).toBe(200);
    expect(response.body.map((row) => row.propertyId).sort()).toEqual(
      [propertyA.id, propertyB.id].sort(),
    );
    expect(Object.keys(response.body[0]).sort()).toEqual([
      'latitude',
      'longitude',
      'propertyId',
    ]);
  });

  it('never returns markers from another organization and validates bounds', async () => {
    const orgA = await createOrganization({ repVisibility: 'organization' });
    const orgB = await createOrganization({ repVisibility: 'organization' });
    const actor = await createUser({
      organizationId: orgA.id,
      role: 'rep',
      label: 'actor',
    });
    const foreignRep = await createUser({
      organizationId: orgB.id,
      role: 'rep',
      label: 'foreign-rep',
    });
    const statusA = await createStatus({ organizationId: orgA.id });
    const statusB = await createStatus({ organizationId: orgB.id });

    const orgAProperty = await createProperty({
      organizationId: orgA.id,
      latitude: 35.61,
      longitude: -84.41,
      normalizedAddress: 'org-a-property',
    });

    const orgBProperty = await createProperty({
      organizationId: orgB.id,
      latitude: 35.62,
      longitude: -84.42,
      normalizedAddress: 'org-b-property',
    });

    await createCurrentInteraction({
      organizationId: orgA.id,
      propertyId: orgAProperty.id,
      userId: actor.id,
      changedBy: actor.id,
      statusId: statusA.id,
      statusName: statusA.name,
      groupLabel: 'org-a',
    });

    await createCurrentInteraction({
      organizationId: orgB.id,
      propertyId: orgBProperty.id,
      userId: foreignRep.id,
      changedBy: foreignRep.id,
      statusId: statusB.id,
      statusName: statusB.name,
      groupLabel: 'org-b',
    });

    const visibleResponse = await getMarkers(
      app,
      authTokenFor(actor, orgA.id),
      bounds,
    );

    expect(visibleResponse.status).toBe(200);
    expect(visibleResponse.body).toHaveLength(1);
    expect(visibleResponse.body[0].propertyId).toBe(orgAProperty.id);

    const invalidBoundsResponse = await request(app)
      .get('/api/map/properties?north=35&south=36&east=-83&west=-85')
      .set('Authorization', `Bearer ${authTokenFor(actor, orgA.id)}`);

    expect(invalidBoundsResponse.status).toBe(400);
    expect(invalidBoundsResponse.body.error.code).toBe('VALIDATION_ERROR');
  });
});
