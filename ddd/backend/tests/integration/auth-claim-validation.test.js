import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { env } from '../../src/config/env.js';

function buildApp() {
  return createApp({
    db: {
      query: async () => ({ rows: [{ ok: 1 }] }),
    },
  });
}

describe('auth claim validation foundation', () => {
  it('accepts token with required claims', async () => {
    const app = buildApp();
    const token = signAccessToken({
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'rep',
    });

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it('rejects token missing subject claim', async () => {
    const app = buildApp();
    const token = jwt.sign(
      {
        organizationId: 'org-1',
        role: 'rep',
      },
      env.jwtSecret,
      { expiresIn: '15m' },
    );

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects token missing organization claim', async () => {
    const app = buildApp();
    const token = jwt.sign(
      {
        role: 'rep',
      },
      env.jwtSecret,
      {
        expiresIn: '15m',
        subject: 'user-1',
      },
    );

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects token missing role claim', async () => {
    const app = buildApp();
    const token = jwt.sign(
      {
        organizationId: 'org-1',
      },
      env.jwtSecret,
      {
        expiresIn: '15m',
        subject: 'user-1',
      },
    );

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects token with malformed required claim', async () => {
    const app = buildApp();
    const token = jwt.sign(
      {
        organizationId: 'org-1',
        role: 'owner',
      },
      env.jwtSecret,
      {
        expiresIn: '15m',
        subject: 'user-1',
      },
    );

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects expired token', async () => {
    const app = buildApp();
    const token = jwt.sign(
      {
        organizationId: 'org-1',
        role: 'rep',
      },
      env.jwtSecret,
      {
        expiresIn: '-1s',
        subject: 'user-1',
      },
    );

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid signature token', async () => {
    const app = buildApp();
    const token = jwt.sign(
      {
        organizationId: 'org-1',
        role: 'rep',
      },
      'wrong-secret',
      {
        expiresIn: '15m',
        subject: 'user-1',
      },
    );

    const response = await request(app)
      .get('/api/_scaffold/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
