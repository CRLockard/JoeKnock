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

async function hasRegistrationSchema() {
  const result = await query(`
    SELECT
      to_regclass('public.organizations') AS organizations_table,
      to_regclass('public.organization_settings') AS settings_table,
      to_regclass('public.users') AS users_table
  `);

  const row = result.rows[0];

  return Boolean(
    row.organizations_table && row.settings_table && row.users_table,
  );
}

async function ensureRegistrationSchemaReady() {
  if (await hasRegistrationSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    // Parallel migration attempts may race in integration runs.
    if (!(await hasRegistrationSchema())) {
      throw error;
    }
  }
}

async function seedUser({
  role = 'admin',
  email = `org-user.${Date.now()}@example.com`,
  organizationName = `Organization ${Date.now()}-${Math.random()}`,
}) {
  const orgResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
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
     RETURNING id, organization_id, role`,
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
    user: userResult.rows[0],
  };
}

describeDb('organization endpoints', () => {
  beforeAll(async () => {
    await ensureRegistrationSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('GET /api/organization returns authenticated organization for manager', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'manager' });

    const token = signAccessToken({
      userId: seeded.user.id,
      organizationId: seeded.organization.id,
      role: seeded.user.role,
    });

    const response = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(seeded.organization.id);
    expect(response.body.name).toBe(seeded.organization.name);
    expect(response.body.createdAt).toBeTruthy();
    expect(response.body.updatedAt).toBeTruthy();
  });

  it('GET /api/organization rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app).get('/api/organization');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /api/organization rejects representative role', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'rep' });

    const token = signAccessToken({
      userId: seeded.user.id,
      organizationId: seeded.organization.id,
      role: seeded.user.role,
    });

    const response = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/organization updates only the authenticated organization name', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'admin' });
    const other = await seedUser({ role: 'admin' });

    const token = signAccessToken({
      userId: seeded.user.id,
      organizationId: seeded.organization.id,
      role: seeded.user.role,
    });

    const response = await request(app)
      .patch('/api/organization')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Organization' });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(seeded.organization.id);
    expect(response.body.name).toBe('Renamed Organization');

    const rows = await query(
      'SELECT id, name FROM organizations WHERE id IN ($1, $2) ORDER BY id',
      [seeded.organization.id, other.organization.id],
    );

    const updated = rows.rows.find((row) => row.id === seeded.organization.id);
    const untouched = rows.rows.find((row) => row.id === other.organization.id);

    expect(updated.name).toBe('Renamed Organization');
    expect(untouched.name).toBe(other.organization.name);
  });

  it('PATCH /api/organization rejects manager role', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'manager' });

    const token = signAccessToken({
      userId: seeded.user.id,
      organizationId: seeded.organization.id,
      role: seeded.user.role,
    });

    const response = await request(app)
      .patch('/api/organization')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should Fail' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/organization validates name', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'admin' });

    const token = signAccessToken({
      userId: seeded.user.id,
      organizationId: seeded.organization.id,
      role: seeded.user.role,
    });

    const response = await request(app)
      .patch('/api/organization')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/organization rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app)
      .patch('/api/organization')
      .send({ name: 'No Auth' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
