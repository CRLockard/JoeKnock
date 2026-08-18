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
  role = 'rep',
  email = `status-view.${Date.now()}@example.com`,
  organizationName = `Statuses View Org ${Date.now()}-${Math.random()}`,
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

describeDb('GET /api/statuses', () => {
  beforeAll(async () => {
    await ensureStatusesSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('returns active statuses for authenticated organization in display order', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });

    await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Interested',
      displayOrder: 2,
      isActive: true,
    });
    await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'No Answer',
      displayOrder: 1,
      isActive: true,
    });
    await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Inactive',
      displayOrder: 3,
      isActive: false,
    });

    const response = await request(app)
      .get('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((status) => status.name)).toEqual([
      'No Answer',
      'Interested',
    ]);
    expect(response.body.every((status) => status.isActive === true)).toBe(
      true,
    );
    expect(response.body[0].displayOrder).toBe(1);
    expect(response.body[1].displayOrder).toBe(2);
  });

  it('does not return statuses from another organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    await createStatusRecord({
      organizationId: actor.organization.id,
      name: 'Inside',
      displayOrder: 1,
      isActive: true,
    });
    await createStatusRecord({
      organizationId: other.organization.id,
      name: 'Outside',
      displayOrder: 1,
      isActive: true,
    });

    const response = await request(app)
      .get('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Inside');
  });

  it('returns an empty array when no active statuses exist', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    const response = await request(app)
      .get('/api/statuses')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app).get('/api/statuses');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
