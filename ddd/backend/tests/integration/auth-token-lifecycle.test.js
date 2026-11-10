import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { hashPassword } from '../../src/auth/password.js';
import { env } from '../../src/config/env.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
  resetRegistrationTables,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;
const PASSWORD = 'Lifecycle-Pass-123!';

async function ensureSchemaReady() {
  const check = () =>
    query(`SELECT to_regclass('public.interactions') AS interactions_table`);

  if ((await check()).rows[0].interactions_table) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await check()).rows[0].interactions_table) {
      throw error;
    }
  }
}

async function createOrganization(name) {
  const result = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [`${name} ${Date.now()}-${Math.random()}`],
  );
  const organizationId = result.rows[0].id;

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', 'UTC')`,
    [organizationId],
  );

  return organizationId;
}

async function createUser({ organizationId, role, label }) {
  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'User', $5, true)
     RETURNING id, organization_id, email, role`,
    [
      organizationId,
      `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`,
      await hashPassword(PASSWORD),
      label,
      role,
    ],
  );

  return result.rows[0];
}

async function createStatus(organizationId) {
  const result = await query(
    `INSERT INTO statuses (organization_id, name, description, display_order, is_active)
     VALUES ($1, 'No Answer', NULL, 1, true)
     RETURNING id`,
    [organizationId],
  );

  return result.rows[0];
}

async function createProperty(organizationId) {
  const result = await query(
    `INSERT INTO properties (
      organization_id, address_line_1, address_line_2, city, state,
      postal_code, country, normalized_address, latitude, longitude
    )
    VALUES ($1, '123 Main St', NULL, 'Knoxville', 'TN', '37901', 'US', $2, 35.5, -84.1)
    RETURNING id`,
    [organizationId, `normalized-${Date.now()}-${Math.random()}`],
  );

  return result.rows[0];
}

async function login(app, user) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: PASSWORD });

  expect(response.status).toBe(200);
  return response.body.token;
}

function bearer(token) {
  return `Bearer ${token}`;
}

describeDb('token lifecycle: deactivation and role changes', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('rejects a pre-deactivation token for protected data and interactions', async () => {
    const organizationId = await createOrganization('Deactivation Org');
    const admin = await createUser({
      organizationId,
      role: 'admin',
      label: 'admin',
    });
    const rep = await createUser({ organizationId, role: 'rep', label: 'rep' });
    const status = await createStatus(organizationId);
    const property = await createProperty(organizationId);

    const adminToken = await login(app, admin);
    const repToken = await login(app, rep);

    const created = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', bearer(repToken))
      .send({ statusId: status.id, notes: 'Before deactivation.' });
    expect(created.status).toBe(201);

    const beforeRead = await request(app)
      .get('/api/statuses')
      .set('Authorization', bearer(repToken));
    expect(beforeRead.status).toBe(200);

    const deactivated = await request(app)
      .patch(`/api/users/${rep.id}/active`)
      .set('Authorization', bearer(adminToken))
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);

    const readAfter = await request(app)
      .get('/api/statuses')
      .set('Authorization', bearer(repToken));
    expect(readAfter.status).toBe(403);
    expect(readAfter.body.error.code).toBe('FORBIDDEN');

    const me = await request(app)
      .get('/api/me')
      .set('Authorization', bearer(repToken));
    expect(me.status).toBe(403);

    const createAfter = await request(app)
      .post(`/api/properties/${property.id}/interactions`)
      .set('Authorization', bearer(repToken))
      .send({ statusId: status.id, notes: 'Should be blocked.' });
    expect(createAfter.status).toBe(403);

    const editAfter = await request(app)
      .post(`/api/interactions/${created.body.interactionId}`)
      .set('Authorization', bearer(repToken))
      .send({ statusId: status.id, notes: 'Edit should be blocked.' });
    expect(editAfter.status).toBe(403);

    const count = await query(
      'SELECT COUNT(*)::int AS count FROM interactions WHERE user_id = $1',
      [rep.id],
    );
    expect(count.rows[0].count).toBe(1);

    const reactivated = await request(app)
      .patch(`/api/users/${rep.id}/active`)
      .set('Authorization', bearer(adminToken))
      .send({ isActive: true });
    expect(reactivated.status).toBe(200);

    const restored = await request(app)
      .get('/api/statuses')
      .set('Authorization', bearer(repToken));
    expect(restored.status).toBe(200);
  });

  it('stops honoring admin claims after the account is demoted', async () => {
    const organizationId = await createOrganization('Demotion Org');
    const rootAdmin = await createUser({
      organizationId,
      role: 'admin',
      label: 'root',
    });
    const demoted = await createUser({
      organizationId,
      role: 'admin',
      label: 'demoted',
    });

    const demotedToken = await login(app, demoted);
    const rootToken = await login(app, rootAdmin);

    const adminOnlyBefore = await request(app)
      .patch(`/api/users/${rootAdmin.id}/active`)
      .set('Authorization', bearer(demotedToken))
      .send({ isActive: true });
    expect(adminOnlyBefore.status).toBe(200);

    const demotion = await request(app)
      .patch(`/api/users/${demoted.id}`)
      .set('Authorization', bearer(rootToken))
      .send({ role: 'rep' });
    expect(demotion.status).toBe(200);

    const adminOnlyAfter = await request(app)
      .patch(`/api/users/${rootAdmin.id}/active`)
      .set('Authorization', bearer(demotedToken))
      .send({ isActive: true });
    expect(adminOnlyAfter.status).toBe(403);

    const managerRoute = await request(app)
      .get('/api/users')
      .set('Authorization', bearer(demotedToken));
    expect(managerRoute.status).toBe(403);

    const me = await request(app)
      .get('/api/me')
      .set('Authorization', bearer(demotedToken));
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('rep');
  });

  it('keeps access for active users and preserves organization isolation', async () => {
    const orgA = await createOrganization('Org A');
    const orgB = await createOrganization('Org B');
    const repA = await createUser({
      organizationId: orgA,
      role: 'rep',
      label: 'rep-a',
    });
    const repB = await createUser({
      organizationId: orgB,
      role: 'rep',
      label: 'rep-b',
    });
    const statusA = await createStatus(orgA);
    const propertyA = await createProperty(orgA);
    const propertyB = await createProperty(orgB);

    const tokenA = await login(app, repA);
    const tokenB = await login(app, repB);

    const own = await request(app)
      .post(`/api/properties/${propertyA.id}/interactions`)
      .set('Authorization', bearer(tokenA))
      .send({ statusId: statusA.id, notes: 'Active rep still works.' });
    expect(own.status).toBe(201);

    const me = await request(app)
      .get('/api/me')
      .set('Authorization', bearer(tokenA));
    expect(me.status).toBe(200);
    expect(me.body.organizationId).toBe(orgA);

    const crossOrg = await request(app)
      .post(`/api/properties/${propertyB.id}/interactions`)
      .set('Authorization', bearer(tokenA))
      .send({ statusId: statusA.id, notes: 'Cross-org attempt.' });
    expect([403, 404]).toContain(crossOrg.status);

    const otherOrgRead = await request(app)
      .get('/api/me')
      .set('Authorization', bearer(tokenB));
    expect(otherOrgRead.body.organizationId).toBe(orgB);

    // A validly signed token claiming a different organization than the
    // account's real one must not authenticate.
    const forged = jwt.sign(
      { organizationId: orgB, role: 'rep' },
      env.jwtSecret,
      {
        expiresIn: '15m',
        subject: repA.id,
      },
    );
    const forgedResponse = await request(app)
      .get('/api/statuses')
      .set('Authorization', bearer(forged));
    expect(forgedResponse.status).toBe(401);
  });
});
