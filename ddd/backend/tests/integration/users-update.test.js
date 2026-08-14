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

async function createOrganization(
  name = `Users Update Org ${Date.now()}-${Math.random()}`,
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
     RETURNING id, organization_id, email, first_name, last_name, role, is_active`,
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

describeDb('PATCH /api/users/:id', () => {
  beforeAll(async () => {
    await ensureRegistrationSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('updates permitted fields for manager within authenticated organization scope', async () => {
    const app = createApp();
    const auth = await seedActor('manager');
    const target = await createUserRecord({
      organizationId: auth.organizationId,
      role: 'rep',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
    });

    const response = await request(app)
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        firstName: 'Janet',
        lastName: 'Johnson',
        role: 'manager',
      });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(target.id);
    expect(response.body.organizationId).toBe(auth.organizationId);
    expect(response.body.firstName).toBe('Janet');
    expect(response.body.lastName).toBe('Johnson');
    expect(response.body.role).toBe('manager');
    expect(response.body.password_hash).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();

    const row = await query(
      'SELECT first_name, last_name, role FROM users WHERE id = $1',
      [target.id],
    );

    expect(row.rows[0].first_name).toBe('Janet');
    expect(row.rows[0].last_name).toBe('Johnson');
    expect(row.rows[0].role).toBe('manager');
  });

  it('allows admin to update another user in the same organization', async () => {
    const app = createApp();
    const auth = await seedActor('admin');
    const target = await createUserRecord({
      organizationId: auth.organizationId,
      role: 'rep',
      firstName: 'Casey',
      lastName: 'Target',
      email: 'casey.target@example.com',
    });

    const response = await request(app)
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ role: 'manager' });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('manager');
  });

  it('rejects representative role for user updates', async () => {
    const app = createApp();
    const auth = await seedActor('rep');

    const response = await request(app)
      .patch(`/api/users/${auth.actor.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ firstName: 'Nope' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app)
      .patch('/api/users/5f3b6413-7ab4-4f1d-8ef0-396f2468f8cd')
      .send({ firstName: 'NoAuth' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns validation errors for malformed requests', async () => {
    const app = createApp();
    const auth = await seedActor('manager');

    const response = await request(app)
      .patch(`/api/users/${auth.actor.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ role: 'owner' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns validation errors when no updatable fields are provided', async () => {
    const app = createApp();
    const auth = await seedActor('manager');

    const response = await request(app)
      .patch(`/api/users/${auth.actor.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not allow cross-organization target updates', async () => {
    const app = createApp();
    const auth = await seedActor('manager');
    const otherOrg = await createOrganization();
    const outsideUser = await createUserRecord({
      organizationId: otherOrg,
      role: 'rep',
      firstName: 'Outside',
      lastName: 'User',
      email: 'outside.user@example.com',
    });

    const response = await request(app)
      .patch(`/api/users/${outsideUser.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ firstName: 'Attempt' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects client-supplied organization ownership fields', async () => {
    const app = createApp();
    const auth = await seedActor('admin');

    const response = await request(app)
      .patch(`/api/users/${auth.actor.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        firstName: 'Alex',
        organizationId: '9d3e86c9-0a8c-4bc0-8b29-95824d66ef76',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects protected field updates and preserves password hash', async () => {
    const app = createApp();
    const auth = await seedActor('admin');
    const target = await createUserRecord({
      organizationId: auth.organizationId,
      role: 'rep',
      firstName: 'Protected',
      lastName: 'Target',
      email: 'protected.target@example.com',
    });

    const preUpdate = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [target.id],
    );

    const response = await request(app)
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        password: 'NewPassword123!',
        email: 'changed@example.com',
        isActive: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const postUpdate = await query(
      'SELECT email, is_active, password_hash FROM users WHERE id = $1',
      [target.id],
    );

    expect(postUpdate.rows[0].email).toBe('protected.target@example.com');
    expect(postUpdate.rows[0].is_active).toBe(true);
    expect(postUpdate.rows[0].password_hash).toBe(
      preUpdate.rows[0].password_hash,
    );
    await expect(
      verifyPassword(postUpdate.rows[0].password_hash, 'NewPassword123!'),
    ).resolves.toBe(false);
  });

  it('returns not found for nonexistent users', async () => {
    const app = createApp();
    const auth = await seedActor('manager');

    const response = await request(app)
      .patch('/api/users/ca2ef5d4-987d-4e45-aa17-ec025bf9ba6c')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ firstName: 'Missing' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});
