import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { hashPassword } from '../../src/auth/password.js';
import { verifyAccessToken } from '../../src/auth/jwt.js';
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
    // In parallel integration runs another worker may apply migrations first.
    if (!(await hasRegistrationSchema())) {
      throw error;
    }
  }
}

async function seedUser({
  email,
  password,
  isActive = true,
  role = 'rep',
  firstName = 'Corey',
  lastName = 'Lopez',
}) {
  const orgResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [`Login Org ${Date.now()}-${Math.random()}`],
  );

  const organizationId = orgResult.rows[0].id;

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', 'UTC')`,
    [organizationId],
  );

  const passwordHash = await hashPassword(password);

  const userResult = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, organization_id, email, first_name, last_name, role, is_active`,
    [
      organizationId,
      email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      isActive,
    ],
  );

  return userResult.rows[0];
}

describeDb('POST /api/auth/login', () => {
  beforeAll(async () => {
    await ensureRegistrationSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('returns JWT and authenticated user context for valid active credentials', async () => {
    const app = createApp();
    const password = 'StrongPass123!';
    const user = await seedUser({
      email: `login.${Date.now()}@example.com`,
      password,
      role: 'manager',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: user.email.toUpperCase(),
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user).toBeTruthy();
    expect(response.body.user.password_hash).toBeUndefined();
    expect(response.body.user.id).toBe(user.id);
    expect(response.body.user.organizationId).toBe(user.organization_id);
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.role).toBe('manager');

    const tokenPayload = verifyAccessToken(response.body.token);

    expect(tokenPayload.sub).toBe(user.id);
    expect(tokenPayload.organizationId).toBe(user.organization_id);
    expect(tokenPayload.role).toBe('manager');
  });

  it('rejects unknown email with authenticated error envelope', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: `missing.${Date.now()}@example.com`,
        password: 'StrongPass123!',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.message).toBe('Invalid email or password.');
  });

  it('rejects invalid password with authenticated error envelope', async () => {
    const app = createApp();
    const user = await seedUser({
      email: `password.${Date.now()}@example.com`,
      password: 'StrongPass123!',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'WrongPass123!',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.message).toBe('Invalid email or password.');
  });

  it('rejects inactive users with forbidden error and does not issue token', async () => {
    const app = createApp();
    const user = await seedUser({
      email: `inactive.${Date.now()}@example.com`,
      password: 'StrongPass123!',
      isActive: false,
    });

    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'StrongPass123!',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toBe('Account is inactive.');
    expect(response.body.token).toBeUndefined();
  });

  it('returns 400 validation envelope for missing email', async () => {
    const app = createApp();

    const response = await request(app).post('/api/auth/login').send({
      password: 'StrongPass123!',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details.some((d) => d.field === 'email')).toBe(
      true,
    );
  });

  it('returns 400 validation envelope for missing password', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: `no-password.${Date.now()}@example.com`,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(
      response.body.error.details.some((d) => d.field === 'password'),
    ).toBe(true);
  });
});
