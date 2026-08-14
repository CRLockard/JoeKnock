import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';

describe('POST /api/auth/logout', () => {
  it('returns logout success for an authenticated request', async () => {
    const app = createApp();
    const token = signAccessToken({
      userId: 'user-logout-1',
      organizationId: 'org-logout-1',
      role: 'rep',
    });

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Logged out successfully.',
    });
  });

  it('rejects logout when authentication is missing', async () => {
    const app = createApp();

    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects logout when token is invalid', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
