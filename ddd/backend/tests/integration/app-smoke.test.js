import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';

describe('backend scaffold smoke', () => {
  it('returns 200 for healthy readiness check', async () => {
    const app = createApp({
      db: {
        query: async () => ({ rows: [{ ok: 1 }] }),
      },
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('returns 503 when database check fails', async () => {
    const app = createApp({
      db: {
        query: async () => {
          throw new Error('db down');
        },
      },
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
  });

  it('rejects unauthenticated scaffold protected route', async () => {
    const app = createApp({
      db: {
        query: async () => ({ rows: [{ ok: 1 }] }),
      },
    });

    const response = await request(app).get('/api/_scaffold/protected');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('accepts valid bearer token on scaffold protected route', async () => {
    const app = createApp({
      db: {
        query: async () => ({ rows: [{ ok: 1 }] }),
      },
    });

    const token = signAccessToken({
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'rep',
    });

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.auth.organizationId).toBe('org-1');
  });

  it('returns validation errors using the shared envelope', async () => {
    const app = createApp({
      db: {
        query: async () => ({ rows: [{ ok: 1 }] }),
      },
    });

    const response = await request(app)
      .post('/api/_scaffold/validate')
      .send({ value: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });
});
