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

async function hasStatusesSchema() {
  const result = await query(`
    SELECT
      to_regclass('public.organizations') AS organizations_table,
      to_regclass('public.organization_settings') AS settings_table,
      to_regclass('public.users') AS users_table,
      to_regclass('public.statuses') AS statuses_table,
      to_regclass('public.interactions') AS interactions_table
  `);

  const row = result.rows[0];

  return Boolean(
    row.organizations_table &&
    row.settings_table &&
    row.users_table &&
    row.statuses_table,
  );
}

async function ensureStatusesSchemaReady() {
  if (await hasStatusesSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasStatusesSchema())) {
      throw error;
    }
  }
}

async function seedAuthenticatedUser({
  role = 'admin',
  email = `status-update.${Date.now()}@example.com`,
  organizationName = `Statuses Update Org ${Date.now()}-${Math.random()}`,
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
    token: signAccessToken({
      userId: userResult.rows[0].id,
      organizationId: organization.id,
      role,
    }),
  };
}

async function createStatusRecord({
  organizationId,
  name,
  description = null,
  displayOrder,
  isActive = true,
}) {
  const result = await query(
    `INSERT INTO statuses (organization_id, name, description, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, organization_id, name, description, display_order, is_active, created_at, updated_at`,
    [organizationId, name, description, displayOrder, isActive],
  );

  return result.rows[0];
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

describeDb('PATCH /api/statuses/:id', () => {
  beforeAll(async () => {
    await ensureStatusesSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('updates permitted fields for manager', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const status = await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'No Answer',
      description: 'Initial',
      displayOrder: 1,
    });

    const response = await request(app)
      .patch(`/api/statuses/${status.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        name: 'Not Home',
        description: 'Updated description',
        displayOrder: 3,
      });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(status.id);
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.name).toBe('Not Home');
    expect(response.body.description).toBe('Updated description');
    expect(response.body.displayOrder).toBe(3);

    const row = await query(
      'SELECT organization_id, name, description, display_order FROM statuses WHERE id = $1',
      [status.id],
    );

    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].organization_id).toBe(actor.organization.id);
    expect(row.rows[0].name).toBe('Not Home');
    expect(row.rows[0].description).toBe('Updated description');
    expect(row.rows[0].display_order).toBe(3);
  });

  it('updates permitted fields for admin', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const status = await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Interested',
      displayOrder: 2,
    });

    const response = await request(app)
      .patch(`/api/statuses/${status.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ description: 'Optional detail', displayOrder: 4 });

    expect(response.status).toBe(200);
    expect(response.body.description).toBe('Optional detail');
    expect(response.body.displayOrder).toBe(4);
  });

  it('rejects representative role access', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });
    const status = await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Blocked',
      displayOrder: 1,
    });

    const response = await request(app)
      .patch(`/api/statuses/${status.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'Still Blocked' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app)
      .patch('/api/statuses/8d3be711-07b6-4f76-bb06-ef2f0b5547f7')
      .send({ name: 'No Auth' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('enforces organization isolation for updates', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const other = await seedAuthenticatedUser({ role: 'admin' });
    const outsideStatus = await createStatusRecord({
      organizationId: other.organization.id,
      name: 'Outside',
      displayOrder: 1,
    });

    const response = await request(app)
      .patch(`/api/statuses/${outsideStatus.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'Nope' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects malformed id and invalid values', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    const badId = await request(app)
      .patch('/api/statuses/not-a-uuid')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'X' });

    expect(badId.status).toBe(400);
    expect(badId.body.error.code).toBe('VALIDATION_ERROR');

    const status = await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Valid',
      displayOrder: 1,
    });

    const badValue = await request(app)
      .patch(`/api/statuses/${status.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ displayOrder: 0 });

    expect(badValue.status).toBe(400);
    expect(badValue.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unsupported fields including organizationId and isActive', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const status = await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Not Mutable',
      displayOrder: 1,
    });

    const response = await request(app)
      .patch(`/api/statuses/${status.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        organizationId: '00000000-0000-0000-0000-000000000000',
        isActive: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects snake_case display_order updates in favor of displayOrder contract', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const status = await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Case Contract',
      displayOrder: 1,
    });

    const response = await request(app)
      .patch(`/api/statuses/${status.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ display_order: 4 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns not found for nonexistent status', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    const response = await request(app)
      .patch('/api/statuses/8d3be711-07b6-4f76-bb06-ef2f0b5547f7')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'Missing' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('does not modify interaction history row counts when updating status', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const status = await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'History Safe',
      displayOrder: 1,
    });

    const before = await getInteractionCount();

    const response = await request(app)
      .patch(`/api/statuses/${status.id}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'History Safe Updated' });

    expect(response.status).toBe(200);

    const after = await getInteractionCount();
    expect(after).toBe(before);
  });
});
