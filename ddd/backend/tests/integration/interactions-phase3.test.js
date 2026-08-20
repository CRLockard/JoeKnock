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

async function hasInteractionSchema() {
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

async function ensureInteractionSchemaReady() {
  if (await hasInteractionSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasInteractionSchema())) {
      throw error;
    }
  }
}

async function createOrganization({
  name = `Org ${Date.now()}-${Math.random()}`,
  repVisibility = 'own',
}) {
  const organizationResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [name],
  );

  const organizationId = organizationResult.rows[0].id;

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, $2, 'UTC')`,
    [organizationId, repVisibility],
  );

  return { id: organizationId };
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
    RETURNING id, organization_id`,
    [organizationId, normalizedAddress, latitude, longitude],
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

function tokenFor(user) {
  return signAccessToken({
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role,
  });
}

describeDb('Phase 3 interactions core endpoints', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureInteractionSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('POST /api/properties/:propertyId/interactions creates first interaction group snapshot', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep-a',
    });
    const property = await createProperty({ organizationId: organization.id });
    const status = await createStatus({ organizationId: organization.id });

    const response = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({
        clientRequestId: '11111111-1111-4111-8111-111111111149',
        statusId: status.id,
        notes: 'Initial conversation.',
        contactName: 'Jamie Homeowner',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      interactionId: expect.any(String),
      interactionGroupId: expect.any(String),
      propertyId: property.id,
      userId: representative.id,
      statusId: status.id,
      statusName: status.name,
      notes: 'Initial conversation.',
      contactName: 'Jamie Homeowner',
      isCurrent: true,
    });

    const rows = await query(
      `SELECT interaction_group_id, is_current, initial_interaction_at, changed_at
       FROM interactions
       WHERE organization_id = $1 AND property_id = $2 AND user_id = $3`,
      [organization.id, property.id, representative.id],
    );

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].is_current).toBe(true);
    expect(rows.rows[0].initial_interaction_at).toBeTruthy();
    expect(rows.rows[0].changed_at).toBeTruthy();
  });

  it('POST /api/properties/:propertyId/interactions allows different representatives to create separate groups', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
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
    const property = await createProperty({ organizationId: organization.id });
    const status = await createStatus({ organizationId: organization.id });

    const first = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(repA)}`)
      .send({ statusId: status.id, notes: 'Rep A first knock.' });

    const second = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(repB)}`)
      .send({ statusId: status.id, notes: 'Rep B first knock.' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.interactionGroupId).not.toBe(
      second.body.interactionGroupId,
    );

    const count = await query(
      `SELECT COUNT(DISTINCT interaction_group_id)::int AS count
       FROM interactions
       WHERE organization_id = $1 AND property_id = $2`,
      [organization.id, property.id],
    );

    expect(count.rows[0].count).toBe(2);
  });

  it('POST /api/properties/:propertyId/interactions prevents duplicate group creation for same representative/property', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
    });
    const property = await createProperty({ organizationId: organization.id });
    const status = await createStatus({ organizationId: organization.id });

    const first = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: status.id, notes: 'First save.' });

    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: status.id, notes: 'Second save should fail.' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('POST /api/properties/:propertyId/interactions reuses original result for duplicate clientRequestId', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
    });
    const property = await createProperty({ organizationId: organization.id });
    const status = await createStatus({ organizationId: organization.id });

    const payload = {
      clientRequestId: '22222222-2222-4222-8222-222222222253',
      statusId: status.id,
      notes: 'Retry-protected save.',
    };

    const first = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send(payload);

    const retry = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send(payload);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.interactionId).toBe(first.body.interactionId);
    expect(retry.body.interactionGroupId).toBe(first.body.interactionGroupId);

    const rows = await query(
      `SELECT COUNT(*)::int AS count
       FROM interactions
       WHERE organization_id = $1 AND user_id = $2 AND property_id = $3`,
      [organization.id, representative.id, property.id],
    );

    expect(rows.rows[0].count).toBe(1);
  });

  it('POST /api/properties/:propertyId/interactions validates malformed property id with standardized envelope', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
      role: 'rep',
    });
    const status = await createStatus({ organizationId: organization.id });

    const response = await request(app)
      .post('/api/properties/not-a-uuid/interactions')
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: status.id });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'propertyId',
          message: 'propertyId must be a valid UUID.',
        }),
      ]),
    );
  });

  it('POST /api/properties/:propertyId/interactions rejects invalid payload and does not persist interaction rows', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
      role: 'rep',
    });
    const property = await createProperty({ organizationId: organization.id });
    const status = await createStatus({ organizationId: organization.id });

    const response = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({
        statusId: status.id,
        unsupportedField: 'not allowed',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: '',
          message:
            'Unsupported fields for interaction request: unsupportedField.',
        }),
      ]),
    );

    const count = await query(
      `SELECT COUNT(*)::int AS count
       FROM interactions
       WHERE organization_id = $1 AND user_id = $2 AND property_id = $3`,
      [organization.id, representative.id, property.id],
    );

    expect(count.rows[0].count).toBe(0);
  });

  it('POST /api/interactions/:id creates a new immutable snapshot and keeps same interaction_group_id', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
    });
    const property = await createProperty({ organizationId: organization.id });
    const statusA = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
    });
    const statusB = await createStatus({
      organizationId: organization.id,
      name: 'Interested',
    });

    const created = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: statusA.id, notes: 'Initial notes' });

    expect(created.status).toBe(201);

    const update = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: statusB.id });

    expect(update.status).toBe(200);
    expect(update.body.interactionId).not.toBe(created.body.interactionId);
    expect(update.body.interactionGroupId).toBe(
      created.body.interactionGroupId,
    );
    expect(update.body.initialInteractionAt).toBe(
      created.body.initialInteractionAt,
    );
    expect(update.body.statusId).toBe(statusB.id);
    expect(update.body.notes).toBe('Initial notes');
    expect(update.body.userId).toBe(representative.id);

    const rows = await query(
      `SELECT id, interaction_group_id, status_name, is_current, initial_interaction_at
       FROM interactions
       WHERE organization_id = $1 AND user_id = $2 AND property_id = $3
       ORDER BY changed_at ASC, id ASC`,
      [organization.id, representative.id, property.id],
    );

    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].is_current).toBe(false);
    expect(rows.rows[1].is_current).toBe(true);
    expect(rows.rows[0].interaction_group_id).toBe(
      rows.rows[1].interaction_group_id,
    );
    expect(rows.rows[0].initial_interaction_at).toEqual(
      rows.rows[1].initial_interaction_at,
    );
  });

  it('POST /api/interactions/:id rejects invalid revision payload without creating a new snapshot', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
      role: 'rep',
    });
    const property = await createProperty({ organizationId: organization.id });
    const status = await createStatus({ organizationId: organization.id });

    const created = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: status.id, notes: 'Initial note.' });

    expect(created.status).toBe(201);

    const emptyPayload = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({});

    expect(emptyPayload.status).toBe(400);
    expect(emptyPayload.body.error.code).toBe('VALIDATION_ERROR');
    expect(emptyPayload.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: '',
          message: 'At least one updatable field is required.',
        }),
      ]),
    );

    const badStatusId = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: 'not-a-uuid' });

    expect(badStatusId.status).toBe(400);
    expect(badStatusId.body.error.code).toBe('VALIDATION_ERROR');
    expect(badStatusId.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'statusId',
          message: 'statusId must be a valid UUID when provided.',
        }),
      ]),
    );

    const badInteractionId = await request(app)
      .post('/api/interactions/not-a-uuid')
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ notes: 'should not matter' });

    expect(badInteractionId.status).toBe(400);
    expect(badInteractionId.body.error.code).toBe('VALIDATION_ERROR');
    expect(badInteractionId.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'id',
          message: 'id must be a valid UUID.',
        }),
      ]),
    );

    const count = await query(
      `SELECT COUNT(*)::int AS count
       FROM interactions
       WHERE organization_id = $1 AND interaction_group_id = $2`,
      [organization.id, created.body.interactionGroupId],
    );

    expect(count.rows[0].count).toBe(1);
  });

  it('POST /api/interactions/:id enforces edit permissions and keeps ownership on manager edit', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const owner = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'owner',
    });
    const repOther = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'other',
    });
    const manager = await createUser({
      organizationId: organization.id,
      role: 'manager',
      label: 'manager',
    });

    const team = await createTeam({
      organizationId: organization.id,
      name: 'Team A',
    });
    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: owner.id,
    });
    await addUserToTeam({
      organizationId: organization.id,
      teamId: team.id,
      userId: manager.id,
    });

    const property = await createProperty({ organizationId: organization.id });
    const statusA = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
    });
    const statusB = await createStatus({
      organizationId: organization.id,
      name: 'Return',
    });

    const created = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`)
      .send({ statusId: statusA.id, notes: 'Owner interaction.' });

    expect(created.status).toBe(201);

    const forbidden = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(repOther)}`)
      .send({ statusId: statusB.id, notes: 'Rep other should be blocked.' });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const managerEdit = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(manager)}`)
      .send({ statusId: statusB.id, notes: 'Manager update.' });

    expect(managerEdit.status).toBe(200);
    expect(managerEdit.body.userId).toBe(owner.id);
    expect(managerEdit.body.changedBy).toBe(manager.id);
  });

  it('GET /api/interactions/:id returns snapshot for authorized viewer and enforces isolation', async () => {
    const orgA = await createOrganization({
      name: 'Org A',
      repVisibility: 'organization',
    });
    const orgB = await createOrganization({
      name: 'Org B',
      repVisibility: 'organization',
    });

    const owner = await createUser({
      organizationId: orgA.id,
      role: 'rep',
      label: 'owner',
    });
    const teammateViewer = await createUser({
      organizationId: orgA.id,
      role: 'manager',
      label: 'viewer',
    });
    const outsider = await createUser({
      organizationId: orgB.id,
      role: 'admin',
      label: 'outsider',
    });

    const property = await createProperty({ organizationId: orgA.id });
    const status = await createStatus({
      organizationId: orgA.id,
      name: 'Interested',
    });

    const created = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`)
      .send({ statusId: status.id, notes: 'Snapshot to view.' });

    expect(created.status).toBe(201);

    const allowed = await request(app)
      .get(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(teammateViewer)}`);

    expect(allowed.status).toBe(200);
    expect(allowed.body).toMatchObject({
      interactionId: created.body.interactionId,
      interactionGroupId: created.body.interactionGroupId,
      propertyId: property.id,
      userId: owner.id,
      statusId: status.id,
      statusName: status.name,
      notes: 'Snapshot to view.',
    });

    const denied = await request(app)
      .get(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(outsider)}`);

    expect(denied.status).toBe(404);
    expect(denied.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET /api/interactions/:id resolves to current snapshot when an older snapshot id is requested', async () => {
    const organization = await createOrganization({ repVisibility: 'own' });
    const representative = await createUser({
      organizationId: organization.id,
      role: 'rep',
      label: 'rep',
    });
    const property = await createProperty({ organizationId: organization.id });
    const statusA = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
    });
    const statusB = await createStatus({
      organizationId: organization.id,
      name: 'Interested',
    });

    const created = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: statusA.id, notes: 'First snapshot notes.' });

    expect(created.status).toBe(201);

    const revised = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: statusB.id, notes: 'Current snapshot notes.' });

    expect(revised.status).toBe(200);

    const oldIdFetch = await request(app)
      .get(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`);

    expect(oldIdFetch.status).toBe(200);
    expect(oldIdFetch.body.interactionId).toBe(revised.body.interactionId);
    expect(oldIdFetch.body.interactionId).not.toBe(created.body.interactionId);
    expect(oldIdFetch.body.isCurrent).toBe(true);
    expect(oldIdFetch.body.notes).toBe('Current snapshot notes.');
    expect(oldIdFetch.body.statusId).toBe(statusB.id);

    const currentIdFetch = await request(app)
      .get(`/api/interactions/${revised.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`);

    expect(currentIdFetch.status).toBe(200);
    expect(currentIdFetch.body.interactionId).toBe(revised.body.interactionId);
    expect(currentIdFetch.body.isCurrent).toBe(true);
  });

  it('enforces exactly one current snapshot per interaction group after multiple revisions', async () => {
    const organization = await createOrganization({
      repVisibility: 'organization',
    });
    const representative = await createUser({
      organizationId: organization.id,
      role: 'rep',
    });
    const property = await createProperty({ organizationId: organization.id });
    const statusA = await createStatus({
      organizationId: organization.id,
      name: 'No Answer',
    });
    const statusB = await createStatus({
      organizationId: organization.id,
      name: 'Return',
    });

    const created = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: statusA.id, notes: 'Snapshot 1' });

    expect(created.status).toBe(201);

    const rev1 = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ statusId: statusB.id, notes: 'Snapshot 2' });

    expect(rev1.status).toBe(200);

    const rev2 = await request(app)
      .post(`/api/interactions/${rev1.body.interactionId}`)
      .set('Authorization', `Bearer ${tokenFor(representative)}`)
      .send({ notes: 'Snapshot 3' });

    expect(rev2.status).toBe(200);

    const rows = await query(
      `SELECT id, is_current
       FROM interactions
       WHERE organization_id = $1 AND interaction_group_id = $2
       ORDER BY changed_at DESC, id DESC`,
      [organization.id, created.body.interactionGroupId],
    );

    expect(rows.rows).toHaveLength(3);

    const currentRows = rows.rows.filter((row) => row.is_current === true);
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0].id).toBe(rev2.body.interactionId);
  });
});
