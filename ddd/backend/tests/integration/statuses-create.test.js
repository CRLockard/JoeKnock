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
      to_regclass('public.statuses') AS statuses_table
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
  email = `status-create.${Date.now()}@example.com`,
  organizationName = `Statuses Create Org ${Date.now()}-${Math.random()}`,
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

describeDb('POST /api/statuses', () => {
  beforeAll(async () => {
    await ensureStatusesSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('creates a status for manager in authenticated organization scope and appends order when omitted', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    await query(
      `INSERT INTO statuses (organization_id, name, description, display_order, is_active)
       VALUES ($1, 'Existing A', NULL, 1, true),
              ($1, 'Existing B', NULL, 2, true)`,
      [actor.organization.id],
    );

    const response = await request(app)
      .post('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        name: 'Interested',
        description: 'Homeowner is interested.',
      });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.name).toBe('Interested');
    expect(response.body.description).toBe('Homeowner is interested.');
    expect(response.body.displayOrder).toBe(3);
    expect(response.body.isActive).toBe(true);

    const rows = await query(
      'SELECT organization_id, name, description, display_order, is_active FROM statuses WHERE id = $1',
      [response.body.id],
    );

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].organization_id).toBe(actor.organization.id);
    expect(rows.rows[0].name).toBe('Interested');
    expect(rows.rows[0].display_order).toBe(3);
    expect(rows.rows[0].is_active).toBe(true);
  });

  it('creates a status for admin and allows optional description', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .post('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        name: 'No Answer',
      });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.description).toBeNull();
    expect(response.body.displayOrder).toBe(1);
  });

  it('ignores client-supplied organization ownership selectors', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .post('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        name: 'Do Not Trust Client Org',
        organizationId: other.organization.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(actor.organization.id);

    const row = await query(
      'SELECT organization_id FROM statuses WHERE id = $1',
      [response.body.id],
    );

    expect(row.rows[0].organization_id).toBe(actor.organization.id);
    expect(row.rows[0].organization_id).not.toBe(other.organization.id);
  });

  it('rejects representative role access', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });

    const response = await request(app)
      .post('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        name: 'Not Allowed',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app).post('/api/statuses').send({
      name: 'No Auth',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('validates required and typed fields', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const missingName = await request(app)
      .post('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ displayOrder: 1 });

    expect(missingName.status).toBe(400);
    expect(missingName.body.error.code).toBe('VALIDATION_ERROR');

    const invalidDisplayOrder = await request(app)
      .post('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'Invalid Order', displayOrder: 0 });

    expect(invalidDisplayOrder.status).toBe(400);
    expect(invalidDisplayOrder.body.error.code).toBe('VALIDATION_ERROR');
  });
});
