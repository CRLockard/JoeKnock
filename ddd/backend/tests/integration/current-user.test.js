import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { env } from '../../src/config/env.js';
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
    // Parallel integration workers can race to apply migrations.
    if (!(await hasRegistrationSchema())) {
      throw error;
    }
  }
}

async function seedUser({
  email,
  role = 'rep',
  isActive = true,
  firstName = 'Corey',
  lastName = 'Lopez',
}) {
  const orgResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [`Current User Org ${Date.now()}-${Math.random()}`],
  );

  const organizationId = orgResult.rows[0].id;

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', 'UTC')`,
    [organizationId],
  );

  const userResult = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, organization_id, email, first_name, last_name, role, is_active`,
    [
      organizationId,
      email.toLowerCase(),
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      firstName,
      lastName,
      role,
      isActive,
    ],
  );

  return {
    organizationId,
    user: userResult.rows[0],
  };
}

describeDb('GET /api/me', () => {
  beforeAll(async () => {
    await ensureRegistrationSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('returns current-user profile for an authenticated request', async () => {
    const app = createApp();
    const seeded = await seedUser({
      email: `me.${Date.now()}@example.com`,
      role: 'manager',
    });

    const token = signAccessToken({
      userId: seeded.user.id,
      organizationId: seeded.organizationId,
      role: seeded.user.role,
    });

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: seeded.user.id,
      firstName: seeded.user.first_name,
      lastName: seeded.user.last_name,
      email: seeded.user.email,
      role: seeded.user.role,
      organizationId: seeded.organizationId,
      teams: [],
    });
    expect(response.body.password_hash).toBeUndefined();
    expect(response.body.is_active).toBeUndefined();
  });

  it('uses authenticated context and ignores client-supplied identity overrides', async () => {
    const app = createApp();
    const userA = await seedUser({ email: `a.${Date.now()}@example.com` });
    const userB = await seedUser({ email: `b.${Date.now()}@example.com` });

    const token = signAccessToken({
      userId: userA.user.id,
      organizationId: userA.organizationId,
      role: userA.user.role,
    });

    const response = await request(app)
      .get('/api/me?userId=' + userB.user.id + '&organizationId=' + userB.organizationId)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(userA.user.id);
    expect(response.body.organizationId).toBe(userA.organizationId);
  });

  it('rejects missing authentication', async () => {
    const app = createApp();

    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid token', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects expired token', async () => {
    const app = createApp();
    const seeded = await seedUser({ email: `expired.${Date.now()}@example.com` });

    const token = jwt.sign(
      {
        organizationId: seeded.organizationId,
        role: seeded.user.role,
      },
      env.jwtSecret,
      {
        expiresIn: '-1s',
        subject: seeded.user.id,
      },
    );

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects token for a nonexistent authenticated user', async () => {
    const app = createApp();

    const token = signAccessToken({
      userId: '6ec26403-2f5e-4a70-aa2a-d4cc47bc5f99',
      organizationId: '9f0543de-df51-4c1f-995b-8b97b88e4f0b',
      role: 'rep',
    });

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects inactive authenticated user', async () => {
    const app = createApp();
    const seeded = await seedUser({
      email: `inactive.${Date.now()}@example.com`,
      isActive: false,
    });

    const token = signAccessToken({
      userId: seeded.user.id,
      organizationId: seeded.organizationId,
      role: seeded.user.role,
    });

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects authenticated token with invalid organization relationship', async () => {
    const app = createApp();
    const userA = await seedUser({ email: `org-a.${Date.now()}@example.com` });
    const userB = await seedUser({ email: `org-b.${Date.now()}@example.com` });

    const token = signAccessToken({
      userId: userA.user.id,
      organizationId: userB.organizationId,
      role: userA.user.role,
    });

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
