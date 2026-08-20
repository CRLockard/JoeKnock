import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApiRoutes } from '../../src/routes/apiRoutes.js';

describe('api scaffold route gating', () => {
  it('does not expose scaffold endpoints when includeTestScaffold is false', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', buildApiRoutes({ includeTestScaffold: false }));

    const protectedResponse = await request(app).get(
      '/api/_scaffold/protected',
    );
    expect(protectedResponse.status).toBe(404);

    const validateResponse = await request(app)
      .post('/api/_scaffold/validate')
      .send({ value: 'x' });
    expect(validateResponse.status).toBe(404);
  });
});
