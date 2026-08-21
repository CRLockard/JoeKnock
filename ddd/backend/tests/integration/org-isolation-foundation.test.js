import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import {
  authenticatedGet,
  createOrgAuthFixtures,
} from '../helpers/authFactory.js';

describe('organization isolation fixture foundation', () => {
  it('distinguishes organization A and B authenticated contexts', async () => {
    const app = createApp({
      db: {
        query: async () => ({ rows: [{ ok: 1 }] }),
      },
    });

    const fixtures = createOrgAuthFixtures();

    const responseA = await authenticatedGet(
      app,
      fixtures.tokenA,
      '/api/_scaffold/protected',
    );

    const responseB = await authenticatedGet(
      app,
      fixtures.tokenB,
      '/api/_scaffold/protected',
    );

    // Confirms the auth fixture generator produces distinct org contexts,
    // which downstream isolation tests depend on.
    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(responseA.body.auth.organizationId).toBe(fixtures.organizationA.id);
    expect(responseB.body.auth.organizationId).toBe(fixtures.organizationB.id);
    expect(responseA.body.auth.organizationId).not.toBe(
      responseB.body.auth.organizationId,
    );
  });
});
