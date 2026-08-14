import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { verifyPassword } from '../../src/auth/password.js';
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

async function seedAuthenticatedUser({
  role = 'admin',
  email = `seed.${Date.now()}@example.com`,
  organizationName = `Users Org ${Date.now()}-${Math.random()}`,
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
    token: signAccessToken({
      userId: userResult.rows[0].id,
      organizationId: organization.id,
      role,
    }),
  };
}

describeDb('POST /api/users', () => {
  beforeAll(async () => {
    await ensureRegistrationSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('creates a user for manager or admin within authenticated organization scope', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'manager' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'StrongPass123!',
        role: 'rep',
      });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('jane@example.com');
    expect(response.body.organizationId).toBe(actor.organization.id);
    expect(response.body.role).toBe('rep');
    expect(response.body.isActive).toBe(true);
    expect(response.body.password_hash).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();

    const userRows = await query(
      'SELECT organization_id, email, role, is_active, password_hash FROM users WHERE id = $1',
      [response.body.id],
    );

    expect(userRows.rows).toHaveLength(1);
    expect(userRows.rows[0].organization_id).toBe(actor.organization.id);
    expect(userRows.rows[0].email).toBe('jane@example.com');
    expect(userRows.rows[0].role).toBe('rep');
    expect(userRows.rows[0].is_active).toBe(true);
    expect(userRows.rows[0].password_hash).not.toBe('StrongPass123!');
    await expect(
      verifyPassword(userRows.rows[0].password_hash, 'StrongPass123!'),
    ).resolves.toBe(true);
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app).post('/api/users').send({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      password: 'StrongPass123!',
      role: 'rep',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects representative role for user creation', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'rep' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'StrongPass123!',
        role: 'rep',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('validates required fields and format constraints', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        firstName: '',
        lastName: '',
        email: 'not-an-email',
        password: '123',
        role: 'owner',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate email within the same organization', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'duplicate@example.com',
        password: 'StrongPass123!',
        role: 'rep',
      });

    const duplicate = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        firstName: 'Janet',
        lastName: 'Smith',
        email: 'DUPLICATE@example.com',
        password: 'StrongPass123!',
        role: 'rep',
      });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('allows same email across different organizations', async () => {
    const app = createApp();
    const actorA = await seedAuthenticatedUser({ role: 'admin' });
    const actorB = await seedAuthenticatedUser({ role: 'admin' });

    const first = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actorA.token}`)
      .send({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'shared@example.com',
        password: 'StrongPass123!',
        role: 'rep',
      });

    const second = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actorB.token}`)
      .send({
        firstName: 'Janet',
        lastName: 'Doe',
        email: 'shared@example.com',
        password: 'StrongPass123!',
        role: 'manager',
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.organizationId).not.toBe(second.body.organizationId);
  });

  it('ignores client-supplied organization ownership selectors', async () => {
    const app = createApp();
    const actor = await seedAuthenticatedUser({ role: 'admin' });
    const other = await seedAuthenticatedUser({ role: 'admin' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        firstName: 'Scoped',
        lastName: 'User',
        email: 'scoped@example.com',
        password: 'StrongPass123!',
        role: 'rep',
        organizationId: other.organization.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(actor.organization.id);

    const row = await query('SELECT organization_id FROM users WHERE id = $1', [
      response.body.id,
    ]);

    expect(row.rows[0].organization_id).toBe(actor.organization.id);
  });
});
