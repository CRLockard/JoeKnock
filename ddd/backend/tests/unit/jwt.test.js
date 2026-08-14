import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/auth/jwt.js';

describe('jwt foundation', () => {
  it('signs and verifies access token', () => {
    const token = signAccessToken({
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'rep',
    });

    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.organizationId).toBe('org-1');
    expect(payload.role).toBe('rep');
  });
});
