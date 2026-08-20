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

async function hasOrganizationSettingsSchema() {
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

async function ensureOrganizationSettingsSchemaReady() {
  if (await hasOrganizationSettingsSchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasOrganizationSettingsSchema())) {
      throw error;
    }
  }
}

async function seedUser({
  role = 'admin',
  email = `org-settings-user.${Date.now()}@example.com`,
  organizationName = `Organization Settings ${Date.now()}-${Math.random()}`,
  repVisibility = 'own',
  timezone = 'UTC',
}) {
  const organizationResult = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
    [organizationName],
  );

  const organization = organizationResult.rows[0];

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, $2, $3)`,
    [organization.id, repVisibility, timezone],
  );

  const userResult = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id, organization_id, role`,
    [
      organization.id,
      email.toLowerCase(),
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      'Corey',
      'Lopez',
      role,
    ],
  );

  return {
    organization,
    user: userResult.rows[0],
    token: signAccessToken({
      userId: userResult.rows[0].id,
      organizationId: organization.id,
      role: userResult.rows[0].role,
    }),
  };
}

describeDb('organization settings endpoints', () => {
  beforeAll(async () => {
    await ensureOrganizationSettingsSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('GET /api/organization/settings returns authenticated organization settings for manager', async () => {
    const app = createApp();
    const seeded = await seedUser({
      role: 'manager',
      repVisibility: 'team',
      timezone: 'America/New_York',
    });

    const response = await request(app)
      .get('/api/organization/settings')
      .set('Authorization', `Bearer ${seeded.token}`);

    expect(response.status).toBe(200);
    expect(response.body.organizationId).toBe(seeded.organization.id);
    expect(response.body.repVisibility).toBe('team');
    expect(response.body.timezone).toBe('America/New_York');
  });

  it('GET /api/organization/settings rejects representative role', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'rep' });

    const response = await request(app)
      .get('/api/organization/settings')
      .set('Authorization', `Bearer ${seeded.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /api/organization/settings rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app).get('/api/organization/settings');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('PATCH /api/organization/settings updates only authenticated organization settings for admin', async () => {
    const app = createApp();
    const seeded = await seedUser({
      role: 'admin',
      repVisibility: 'own',
      timezone: 'UTC',
    });
    const other = await seedUser({
      role: 'admin',
      repVisibility: 'organization',
      timezone: 'America/Chicago',
    });

    const response = await request(app)
      .patch('/api/organization/settings')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        rep_visibility: 'team',
        timezone: 'America/Los_Angeles',
      });

    expect(response.status).toBe(200);
    expect(response.body.organizationId).toBe(seeded.organization.id);
    expect(response.body.repVisibility).toBe('team');
    expect(response.body.timezone).toBe('America/Los_Angeles');

    const rows = await query(
      `SELECT organization_id, rep_visibility, timezone
       FROM organization_settings
       WHERE organization_id IN ($1, $2)
       ORDER BY organization_id`,
      [seeded.organization.id, other.organization.id],
    );

    const updated = rows.rows.find(
      (row) => row.organization_id === seeded.organization.id,
    );
    const untouched = rows.rows.find(
      (row) => row.organization_id === other.organization.id,
    );

    expect(updated.rep_visibility).toBe('team');
    expect(updated.timezone).toBe('America/Los_Angeles');
    expect(untouched.rep_visibility).toBe('organization');
    expect(untouched.timezone).toBe('America/Chicago');
  });

  it('PATCH /api/organization/settings rejects manager role', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'manager' });

    const response = await request(app)
      .patch('/api/organization/settings')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ rep_visibility: 'team' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/organization/settings validates visibility and timezone values', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'admin' });

    const invalidVisibilityResponse = await request(app)
      .patch('/api/organization/settings')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ rep_visibility: 'self' });

    expect(invalidVisibilityResponse.status).toBe(400);
    expect(invalidVisibilityResponse.body.error.code).toBe('VALIDATION_ERROR');

    const invalidTimezoneResponse = await request(app)
      .patch('/api/organization/settings')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ timezone: 'Mars/OlympusMons' });

    expect(invalidTimezoneResponse.status).toBe(400);
    expect(invalidTimezoneResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/organization/settings rejects client ownership override fields', async () => {
    const app = createApp();
    const seeded = await seedUser({ role: 'admin' });
    const other = await seedUser({ role: 'admin' });

    const response = await request(app)
      .patch('/api/organization/settings')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        rep_visibility: 'team',
        organizationId: other.organization.id,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const otherSettings = await query(
      `SELECT rep_visibility
       FROM organization_settings
       WHERE organization_id = $1`,
      [other.organization.id],
    );

    expect(otherSettings.rows[0].rep_visibility).toBe('own');
  });

  it('PATCH /api/organization/settings rejects unauthenticated requests', async () => {
    const app = createApp();

    const response = await request(app)
      .patch('/api/organization/settings')
      .send({ rep_visibility: 'team' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
