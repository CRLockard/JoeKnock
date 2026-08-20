import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { query } from '../../src/db/client.js';
import { createPropertiesService } from '../../src/properties/propertiesService.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
  resetRegistrationTables,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;

async function hasPropertySchema() {
  const result = await query(`
    SELECT
      to_regclass('public.organizations') AS organizations_table,
      to_regclass('public.users') AS users_table,
      to_regclass('public.properties') AS properties_table
  `);

  const row = result.rows[0];
  return Boolean(
    row.organizations_table && row.users_table && row.properties_table,
  );
}

async function ensurePropertySchemaReady() {
  if (await hasPropertySchema()) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await hasPropertySchema())) {
      throw error;
    }
  }
}

async function createOrganization(name) {
  const result = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [name],
  );

  return result.rows[0].id;
}

async function createUser({ organizationId, role = 'rep', label = 'user' }) {
  const email = `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id, organization_id, role`,
    [
      organizationId,
      email,
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI',
      label,
      'User',
      role,
    ],
  );

  return result.rows[0];
}

function tokenFor(user) {
  return signAccessToken({
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role,
  });
}

function appWithGeocoder(geocodingProvider) {
  const propertiesService = createPropertiesService({ geocodingProvider });
  return createApp({ propertiesService });
}

function buildResolvableAddress(overrides = {}) {
  return {
    addressLine1: '123 Main Street',
    addressLine2: null,
    city: 'Knoxville',
    state: 'TN',
    postalCode: '37901',
    country: 'US',
    latitude: 35.9,
    longitude: -84.0,
    ...overrides,
  };
}

describeDb('POST /api/properties/resolve', () => {
  beforeAll(async () => {
    await ensurePropertySchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('rejects unauthenticated requests', async () => {
    const geocodingProvider = {
      reverseGeocode: vi.fn(),
    };

    const response = await request(appWithGeocoder(geocodingProvider))
      .post('/api/properties/resolve')
      .send({ latitude: 35.9, longitude: -84.0 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(geocodingProvider.reverseGeocode).not.toHaveBeenCalled();
  });

  it('validates coordinates and unsupported fields', async () => {
    const orgId = await createOrganization('Org A');
    const user = await createUser({ organizationId: orgId, label: 'actor' });

    const geocodingProvider = {
      reverseGeocode: vi.fn(),
    };

    const app = appWithGeocoder(geocodingProvider);

    const invalidCoordinates = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ latitude: 200, longitude: -84.0 });

    expect(invalidCoordinates.status).toBe(400);
    expect(invalidCoordinates.body.error.code).toBe('VALIDATION_ERROR');

    const unsupportedField = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ latitude: 35.9, longitude: -84.0, organizationId: 'evil' });

    expect(unsupportedField.status).toBe(400);
    expect(unsupportedField.body.error.code).toBe('VALIDATION_ERROR');
    expect(geocodingProvider.reverseGeocode).not.toHaveBeenCalled();
  });

  it('creates a new property when no match exists and reuses it on repeat resolution', async () => {
    const orgId = await createOrganization('Org A');
    const user = await createUser({ organizationId: orgId, label: 'actor' });

    const geocodingProvider = {
      reverseGeocode: vi.fn(async () => buildResolvableAddress()),
    };

    const app = appWithGeocoder(geocodingProvider);

    const first = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ latitude: 35.9, longitude: -84.0 });

    expect(first.status).toBe(200);
    expect(first.body.created).toBe(true);
    expect(first.body.property).toMatchObject({
      propertyId: expect.any(String),
      latitude: 35.9,
      longitude: -84,
    });

    const second = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ latitude: 35.9, longitude: -84.0 });

    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.property.propertyId).toBe(
      first.body.property.propertyId,
    );

    const count = await query(
      'SELECT COUNT(*)::int AS count FROM properties WHERE organization_id = $1',
      [orgId],
    );

    expect(count.rows[0].count).toBe(1);
  });

  it('enforces organization isolation for the same normalized address', async () => {
    const orgA = await createOrganization('Org A');
    const orgB = await createOrganization('Org B');
    const userA = await createUser({ organizationId: orgA, label: 'a' });
    const userB = await createUser({ organizationId: orgB, label: 'b' });

    const geocodingProvider = {
      reverseGeocode: vi.fn(async () => buildResolvableAddress()),
    };

    const app = appWithGeocoder(geocodingProvider);

    const responseA = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(userA)}`)
      .send({ latitude: 35.9, longitude: -84.0 });

    const responseB = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(userB)}`)
      .send({ latitude: 35.9, longitude: -84.0 });

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(responseA.body.property.propertyId).not.toBe(
      responseB.body.property.propertyId,
    );

    const count = await query(
      'SELECT COUNT(*)::int AS count FROM properties WHERE normalized_address = $1',
      ['123 main st|knoxville|tn|37901|us'],
    );

    expect(count.rows[0].count).toBe(2);
  });

  it('returns 422 when provider yields no usable address and does not persist', async () => {
    const orgId = await createOrganization('Org A');
    const user = await createUser({ organizationId: orgId, label: 'actor' });

    const geocodingProvider = {
      reverseGeocode: vi.fn(async () => null),
    };

    const app = appWithGeocoder(geocodingProvider);

    const response = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ latitude: 35.9, longitude: -84.0 });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('PROPERTY_LOCATION_UNRESOLVABLE');

    const count = await query('SELECT COUNT(*)::int AS count FROM properties');
    expect(count.rows[0].count).toBe(0);
  });

  it('contains provider failures behind internal error behavior', async () => {
    const orgId = await createOrganization('Org A');
    const user = await createUser({ organizationId: orgId, label: 'actor' });

    const geocodingProvider = {
      reverseGeocode: vi.fn(async () => {
        throw new Error('provider down');
      }),
    };

    const app = appWithGeocoder(geocodingProvider);

    const response = await request(app)
      .post('/api/properties/resolve')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ latitude: 35.9, longitude: -84.0 });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');

    const count = await query('SELECT COUNT(*)::int AS count FROM properties');
    expect(count.rows[0].count).toBe(0);
  });

  it('avoids duplicate persistence under near-simultaneous resolve requests', async () => {
    const orgId = await createOrganization('Org A');
    const user = await createUser({ organizationId: orgId, label: 'actor' });

    let calls = 0;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    const geocodingProvider = {
      reverseGeocode: vi.fn(async () => {
        calls += 1;

        if (calls === 2) {
          release();
        }

        await gate;

        return buildResolvableAddress();
      }),
    };

    const app = appWithGeocoder(geocodingProvider);

    const [left, right] = await Promise.all([
      request(app)
        .post('/api/properties/resolve')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ latitude: 35.9, longitude: -84.0 }),
      request(app)
        .post('/api/properties/resolve')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ latitude: 35.9, longitude: -84.0 }),
    ]);

    expect(left.status).toBe(200);
    expect(right.status).toBe(200);
    expect(left.body.property.propertyId).toBe(right.body.property.propertyId);

    const createdFlags = [left.body.created, right.body.created].filter(
      Boolean,
    );
    expect(createdFlags).toHaveLength(1);

    const count = await query(
      'SELECT COUNT(*)::int AS count FROM properties WHERE organization_id = $1',
      [orgId],
    );

    expect(count.rows[0].count).toBe(1);
  });
});
