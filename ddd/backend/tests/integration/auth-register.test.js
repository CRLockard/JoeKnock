import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { verifyPassword } from '../../src/auth/password.js';
import { verifyAccessToken } from '../../src/auth/jwt.js';
import { createAuthService } from '../../src/auth/authService.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
  resetRegistrationTables,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;

function createPayload(overrides = {}) {
  const id = Date.now().toString();

  return {
    organizationName: `Org ${id}`,
    firstName: 'Corey',
    lastName: 'Lopez',
    email: `corey.${id}@example.com`,
    password: 'StrongPass123!',
    timezone: 'UTC',
    ...overrides,
  };
}

describeDb('POST /api/auth/register', () => {
  it('creates organization, settings, and administrator atomically', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const app = createApp();
    const payload = createPayload();

    const response = await request(app)
      .post('/api/auth/register')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user).toBeTruthy();
    expect(response.body.user.organizationId).toBeTruthy();
    expect(response.body.user.role).toBe('admin');
    expect(response.body.user.email).toBe(payload.email.toLowerCase());
    expect(response.body.user.password_hash).toBeUndefined();

    const orgRows = await query(
      'SELECT id, name FROM organizations WHERE id = $1',
      [response.body.user.organizationId],
    );

    expect(orgRows.rows).toHaveLength(1);
    expect(orgRows.rows[0].name).toBe(payload.organizationName);

    const settingsRows = await query(
      'SELECT rep_visibility, timezone FROM organization_settings WHERE organization_id = $1',
      [response.body.user.organizationId],
    );

    expect(settingsRows.rows).toHaveLength(1);
    expect(settingsRows.rows[0].rep_visibility).toBe('own');
    expect(settingsRows.rows[0].timezone).toBe(payload.timezone);

    const userRows = await query(
      'SELECT email, password_hash, role, organization_id FROM users WHERE id = $1',
      [response.body.user.id],
    );

    expect(userRows.rows).toHaveLength(1);
    expect(userRows.rows[0].email).toBe(payload.email.toLowerCase());
    expect(userRows.rows[0].role).toBe('admin');
    expect(userRows.rows[0].organization_id).toBe(
      response.body.user.organizationId,
    );
    expect(userRows.rows[0].password_hash).not.toBe(payload.password);
    await expect(
      verifyPassword(userRows.rows[0].password_hash, payload.password),
    ).resolves.toBe(true);

    const tokenPayload = verifyAccessToken(response.body.token);

    expect(tokenPayload.sub).toBe(response.body.user.id);
    expect(tokenPayload.organizationId).toBe(response.body.user.organizationId);
    expect(tokenPayload.role).toBe('admin');
  });

  it('rejects invalid registration payload with 400 and no persisted records', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const app = createApp();

    const missingFields = await request(app).post('/api/auth/register').send({
      organizationName: '',
      firstName: '',
      lastName: '',
      email: 'bad-email',
      password: '123',
      timezone: '',
    });

    expect(missingFields.status).toBe(400);
    expect(missingFields.body.error.code).toBe('VALIDATION_ERROR');

    const counts = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM organizations) AS organizations_count,
        (SELECT COUNT(*)::int FROM organization_settings) AS settings_count,
        (SELECT COUNT(*)::int FROM users) AS users_count
    `);

    expect(counts.rows[0].organizations_count).toBe(0);
    expect(counts.rows[0].settings_count).toBe(0);
    expect(counts.rows[0].users_count).toBe(0);
  });

  it('rejects registration when timezone is missing', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const app = createApp();
    const payload = createPayload();
    delete payload.timezone;

    const response = await request(app)
      .post('/api/auth/register')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const counts = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM organizations) AS organizations_count,
        (SELECT COUNT(*)::int FROM organization_settings) AS settings_count,
        (SELECT COUNT(*)::int FROM users) AS users_count
    `);

    expect(counts.rows[0].organizations_count).toBe(0);
    expect(counts.rows[0].settings_count).toBe(0);
    expect(counts.rows[0].users_count).toBe(0);
  });

  it('rejects registration when timezone is not a valid IANA timezone identifier', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const app = createApp();
    const response = await request(app)
      .post('/api/auth/register')
      .send(createPayload({ timezone: 'Not/A_Real_Timezone' }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const counts = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM organizations) AS organizations_count,
        (SELECT COUNT(*)::int FROM organization_settings) AS settings_count,
        (SELECT COUNT(*)::int FROM users) AS users_count
    `);

    expect(counts.rows[0].organizations_count).toBe(0);
    expect(counts.rows[0].settings_count).toBe(0);
    expect(counts.rows[0].users_count).toBe(0);
  });

  it('accepts America/New_York only when explicitly submitted and persists it', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const app = createApp();
    const payload = createPayload({ timezone: 'America/New_York' });

    const response = await request(app)
      .post('/api/auth/register')
      .send(payload);

    expect(response.status).toBe(201);

    const settingsRows = await query(
      'SELECT timezone FROM organization_settings WHERE organization_id = $1',
      [response.body.user.organizationId],
    );

    expect(settingsRows.rows).toHaveLength(1);
    expect(settingsRows.rows[0].timezone).toBe('America/New_York');
  });

  it('allows the same email across different organizations', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const app = createApp();
    const sharedEmail = `shared.${Date.now()}@example.com`;

    const first = await request(app)
      .post('/api/auth/register')
      .send(createPayload({ organizationName: 'Org One', email: sharedEmail }));

    const second = await request(app)
      .post('/api/auth/register')
      .send(createPayload({ organizationName: 'Org Two', email: sharedEmail }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const users = await query(
      'SELECT organization_id FROM users WHERE lower(email) = lower($1)',
      [sharedEmail],
    );

    expect(users.rows).toHaveLength(2);
    expect(users.rows[0].organization_id).not.toBe(
      users.rows[1].organization_id,
    );
  });

  it('rolls back all writes when a failure occurs mid-registration transaction', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const failingAuthService = createAuthService({
      onOrganizationCreated: async () => {
        throw new Error('forced-rollback');
      },
    });

    const app = createApp({ authService: failingAuthService });
    const payload = createPayload({
      organizationName: `Rollback Org ${Date.now()}`,
      email: `rollback.${Date.now()}@example.com`,
    });

    const response = await request(app)
      .post('/api/auth/register')
      .send(payload);

    expect(response.status).toBe(500);

    const orphanOrg = await query(
      'SELECT COUNT(*)::int AS count FROM organizations WHERE name = $1',
      [payload.organizationName],
    );

    const orphanUser = await query(
      'SELECT COUNT(*)::int AS count FROM users WHERE lower(email) = lower($1)',
      [payload.email],
    );

    expect(orphanOrg.rows[0].count).toBe(0);
    expect(orphanUser.rows[0].count).toBe(0);
  });

  it('enforces organization-scoped duplicate email uniqueness at the database level', async () => {
    await ensureTestMigrations();
    await resetRegistrationTables();

    const orgResult = await query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      [`Constraint Org ${Date.now()}`],
    );

    const orgId = orgResult.rows[0].id;

    await query(
      `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
       VALUES ($1, 'own', 'America/New_York')`,
      [orgId],
    );

    const passwordHash =
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI';

    await query(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orgId, 'same@example.com', passwordHash, 'A', 'User', 'admin', true],
    );

    await expect(
      query(
        `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orgId, 'SAME@example.com', passwordHash, 'B', 'User', 'admin', true],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
