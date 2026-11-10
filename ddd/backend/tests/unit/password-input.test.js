import { describe, expect, it } from 'vitest';
import { validationResult } from 'express-validator';
import {
  loginValidators,
  registerValidators,
} from '../../src/auth/authValidation.js';
import { createUserValidators } from '../../src/users/usersValidation.js';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

async function validate(validators, password) {
  const req = {
    body: {
      password,
      email: 'audit@example.com',
      firstName: 'Test',
      lastName: 'User',
      organizationName: 'Audit',
      timezone: 'UTC',
      role: 'rep',
    },
  };
  for (const validator of validators) await validator.run(req);
  return { password: req.body.password, errors: validationResult(req).array() };
}

describe('password input consistency', () => {
  it.each([
    ' leading-space-123',
    'trailing-space-123 ',
    ' internal spaces 123 ',
    'tab-ending-123\t',
    'Café-屋-🔐-123',
  ])('verifies the exact creation input %j', async (password) => {
    for (const validators of [registerValidators, createUserValidators]) {
      const created = await validate(validators, password);
      expect(created.errors).toEqual([]);
      const hash = await hashPassword(created.password);
      const login = await validate(loginValidators, password);
      expect(login.errors).toEqual([]);
      expect(login.password).toBe(password);
      expect(await verifyPassword(hash, login.password)).toBe(true);
      if (password !== password.trim())
        expect(await verifyPassword(hash, password.trim())).toBe(false);
    }
  });
  it('still rejects an empty login secret', async () => {
    expect((await validate(loginValidators, '')).errors.length).toBeGreaterThan(
      0,
    );
  });
});
