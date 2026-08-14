import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { hashPassword } from '../../src/auth/password.js';
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
    // Integration suites can race while applying migrations.
    if (!(await hasRegistrationSchema())) {
      throw error;
    }
  }
}

async function createOrganization(
  name = `Users Deactivate Org ${Date.now()}-${Math.random()}`,
) {
  const orgResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [name],
  );

  const organizationId = orgResult.rows[0].id;

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', 'UTC')`,
    [organizationId],
  );

  return organizationId;
}

async function createUserRecord({
  organizationId,
  role = 'rep',
  isActive = true,
  firstName = 'Taylor',
  lastName = 'User',
  email,
  passwordHash,
}) {
  const resolvedEmail =
    email ?? `${firstName}.${lastName}.${Date.now()}@example.com`;

  const resolvedPasswordHash =
    passwordHash ??
    '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI';

  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at`,
    [
      organizationId,
      resolvedEmail.toLowerCase(),
      resolvedPasswordHash,
      firstName,
      lastName,
      role,
      isActive,
    ],
  );

  return result.rows[0];
}

async function seedActor(role = 'admin') {
  const organizationId = await createOrganization();
  const actor = await createUserRecord({
    organizationId,
    role,
    firstName:
      role === 'admin' ? 'Alex' : role === 'manager' ? 'Morgan' : 'Riley',
    lastName: role,
    email: `actor.${role}.${Date.now()}@example.com`,
  });

  return {
    organizationId,
    actor,
    token: signAccessToken({
      userId: actor.id,
      organizationId,
      role,
    }),
  };
}

describeDb('PATCH /api/users/:id/active', () => {
  beforeAll(async () => {
    await ensureRegistrationSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('deactivates a same-organization user for admin and preserves user row', async () => {
    const app = createApp();
    const admin = await seedActor('admin');
    const target = await createUserRecord({
      organizationId: admin.organizationId,
      role: 'rep',
      firstName: 'Dee',
      lastName: 'Active',
      email: 'dee.active@example.com',
      isActive: true,
    });

    const response = await request(app)
      .patch(`/api/users/${target.id}/active`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(target.id);
    expect(response.body.organizationId).toBe(admin.organizationId);
    expect(response.body.isActive).toBe(false);
    expect(response.body.password_hash).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();

    const row = await query(
      'SELECT is_active, updated_at FROM users WHERE id = $1',
      [target.id],
    );

    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].is_active).toBe(false);
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app)
      .patch('/api/users/e9e14f1a-b8b1-4cf7-aa24-86a6227541cf/active')
      .send({ isActive: false });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects non-admin roles for deactivation', async () => {
    const app = createApp();
    const manager = await seedActor('manager');

    const response = await request(app)
      .patch(`/api/users/${manager.actor.id}/active`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ isActive: false });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('enforces organization isolation for target user lookup', async () => {
    const app = createApp();
    const admin = await seedActor('admin');
    const otherOrganizationId = await createOrganization();
    const outsideUser = await createUserRecord({
      organizationId: otherOrganizationId,
      role: 'rep',
      firstName: 'Outside',
      lastName: 'User',
      email: 'outside.deactivate@example.com',
    });

    const response = await request(app)
      .patch(`/api/users/${outsideUser.id}/active`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects client-supplied organization selectors', async () => {
    const app = createApp();
    const admin = await seedActor('admin');

    const response = await request(app)
      .patch(`/api/users/${admin.actor.id}/active`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        isActive: false,
        organizationId: '9940f2ac-c95e-481f-b4e2-ba2b8188f2bb',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns not found for nonexistent users', async () => {
    const app = createApp();
    const admin = await seedActor('admin');

    const response = await request(app)
      .patch('/api/users/ca2ef5d4-987d-4e45-aa17-ec025bf9ba6c/active')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('supports idempotent deactivation for already-inactive users', async () => {
    const app = createApp();
    const admin = await seedActor('admin');
    const target = await createUserRecord({
      organizationId: admin.organizationId,
      role: 'rep',
      firstName: 'Ina',
      lastName: 'Ctive',
      email: 'ina.ctive@example.com',
      isActive: false,
    });

    const response = await request(app)
      .patch(`/api/users/${target.id}/active`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);

    const row = await query('SELECT is_active FROM users WHERE id = $1', [
      target.id,
    ]);

    expect(row.rows[0].is_active).toBe(false);
  });

  it('reactivates a user when isActive is true', async () => {
    const app = createApp();
    const admin = await seedActor('admin');
    const target = await createUserRecord({
      organizationId: admin.organizationId,
      role: 'rep',
      firstName: 'Re',
      lastName: 'Enable',
      email: 're.enable@example.com',
      isActive: false,
    });

    const response = await request(app)
      .patch(`/api/users/${target.id}/active`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(true);

    const row = await query('SELECT is_active FROM users WHERE id = $1', [
      target.id,
    ]);

    expect(row.rows[0].is_active).toBe(true);
  });

  it('deactivated users cannot log in with valid credentials', async () => {
    const app = createApp();
    const admin = await seedActor('admin');
    const password = 'StrongPass123!';
    const passwordHash = await hashPassword(password);

    const target = await createUserRecord({
      organizationId: admin.organizationId,
      role: 'rep',
      firstName: 'Login',
      lastName: 'Blocked',
      email: 'login.blocked@example.com',
      isActive: true,
      passwordHash,
    });

    await request(app)
      .patch(`/api/users/${target.id}/active`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'login.blocked@example.com',
      password,
    });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.error.code).toBe('FORBIDDEN');
  });

  it('allows admin self-deactivation per current API contract', async () => {
    const app = createApp();
    const admin = await seedActor('admin');

    const response = await request(app)
      .patch(`/api/users/${admin.actor.id}/active`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(admin.actor.id);
    expect(response.body.isActive).toBe(false);
  });
});
