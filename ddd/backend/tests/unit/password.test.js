import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('password foundation', () => {
  it('hashes and verifies a password with argon2id', async () => {
    const raw = 'StrongPassword123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    await expect(verifyPassword(hash, raw)).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });
});
