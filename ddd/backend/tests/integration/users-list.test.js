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
    // Integration suites can race while applying migrations.
    if (!(await hasRegistrationSchema())) {
      throw error;
    }
  }
}

async function createOrganization(
  name = `Users Org ${Date.now()}-${Math.random()}`,
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
}) {
  const resolvedEmail =
    email ?? `${firstName}.${lastName}.${Date.now()}@example.com`;

  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at`,
    [
      organizationId,
      resolvedEmail.toLowerCase(),
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      firstName,
      lastName,
      role,
      isActive,
    ],
  );

  return result.rows[0];
}

async function seedActor(role = 'manager') {
  const organizationId = await createOrganization();
  const actor = await createUserRecord({
    organizationId,
    role,
    firstName: 'Casey',
    lastName: role === 'admin' ? 'Admin' : 'Manager',
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

describeDb('GET /api/users', () => {
  beforeAll(async () => {
    await ensureRegistrationSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('returns organization users for manager/admin and excludes other organizations', async () => {
    const app = createApp();
    const auth = await seedActor('manager');

    await createUserRecord({
      organizationId: auth.organizationId,
      role: 'rep',
      firstName: 'Alex',
      lastName: 'Able',
      email: 'alex.able@example.com',
    });

    const otherOrganizationId = await createOrganization();
    const outsideUser = await createUserRecord({
      organizationId: otherOrganizationId,
      role: 'rep',
      firstName: 'Blake',
      lastName: 'Outside',
      email: 'blake.outside@example.com',
    });

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(2);

    const emails = response.body.map((user) => user.email);
    expect(emails).toContain('alex.able@example.com');
    expect(emails).toContain(auth.actor.email);
    expect(emails).not.toContain(outsideUser.email);

    for (const user of response.body) {
      expect(user.organizationId).toBe(auth.organizationId);
      expect(user.password_hash).toBeUndefined();
      expect(user.passwordHash).toBeUndefined();
    }
  });

  it('supports filtering by active status', async () => {
    const app = createApp();
    const auth = await seedActor('admin');

    await createUserRecord({
      organizationId: auth.organizationId,
      role: 'rep',
      isActive: true,
      firstName: 'Active',
      lastName: 'Rep',
      email: 'active.rep@example.com',
    });

    await createUserRecord({
      organizationId: auth.organizationId,
      role: 'rep',
      isActive: false,
      firstName: 'Inactive',
      lastName: 'Rep',
      email: 'inactive.rep@example.com',
    });

    const activeResponse = await request(app)
      .get('/api/users?active=true')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.every((user) => user.isActive === true)).toBe(
      true,
    );

    const inactiveResponse = await request(app)
      .get('/api/users?active=false')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(inactiveResponse.status).toBe(200);
    expect(inactiveResponse.body.every((user) => user.isActive === false)).toBe(
      true,
    );
  });

  it('supports filtering by role', async () => {
    const app = createApp();
    const auth = await seedActor('admin');

    await createUserRecord({
      organizationId: auth.organizationId,
      role: 'rep',
      firstName: 'Riley',
      lastName: 'Rep',
      email: 'riley.rep@example.com',
    });

    await createUserRecord({
      organizationId: auth.organizationId,
      role: 'manager',
      firstName: 'Mara',
      lastName: 'Manager',
      email: 'mara.manager@example.com',
    });

    const response = await request(app)
      .get('/api/users?role=manager')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
    expect(response.body.every((user) => user.role === 'manager')).toBe(true);
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app).get('/api/users');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects representative role access', async () => {
    const app = createApp();
    const auth = await seedActor('rep');

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid active filter values', async () => {
    const app = createApp();
    const auth = await seedActor('manager');

    const response = await request(app)
      .get('/api/users?active=maybe')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid role filter values', async () => {
    const app = createApp();
    const auth = await seedActor('manager');

    const response = await request(app)
      .get('/api/users?role=owner')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects teamId filter as blocked until teams foundation tickets are implemented', async () => {
    const app = createApp();
    const auth = await seedActor('manager');

    const response = await request(app)
      .get('/api/users?teamId=8d3be711-07b6-4f76-bb06-ef2f0b5547f7')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'teamId' })]),
    );
  });
});
