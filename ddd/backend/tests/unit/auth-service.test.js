import { describe, expect, it } from 'vitest';
import { createAuthService } from '../../src/auth/authService.js';
import { AppError } from '../../src/common/errors.js';

describe('auth service duplicate conflict mapping', () => {
  it('maps unique-constraint violations to 409 conflict', async () => {
    const repository = {
      async createOrganization() {
        return { id: 'org-1' };
      },
      async createOrganizationSettings() {
        return { id: 'settings-1' };
      },
      async createUser() {
        const error = new Error('duplicate');
        error.code = '23505';
        throw error;
      },
    };

    const service = createAuthService({
      repository,
      runInTransaction: async (callback) => callback({ query: async () => {} }),
      passwordHasher: async () => 'hash',
      tokenSigner: () => 'token',
    });

    await expect(
      service.registerOrganization({
        organizationName: 'Org',
        firstName: 'A',
        lastName: 'B',
        email: 'test@example.com',
        password: 'StrongPass123!',
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      service.registerOrganization({
        organizationName: 'Org',
        firstName: 'A',
        lastName: 'B',
        email: 'test@example.com',
        password: 'StrongPass123!',
        timezone: 'UTC',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('uses the explicitly submitted timezone when creating organization settings', async () => {
    const observed = {
      timezone: null,
    };

    const repository = {
      async createOrganization() {
        return { id: 'org-1' };
      },
      async createOrganizationSettings(_client, args) {
        observed.timezone = args.timezone;
        return { id: 'settings-1' };
      },
      async createUser() {
        return {
          id: 'user-1',
          organization_id: 'org-1',
          first_name: 'A',
          last_name: 'B',
          email: 'test@example.com',
          role: 'admin',
          is_active: true,
        };
      },
    };

    const service = createAuthService({
      repository,
      runInTransaction: async (callback) => callback({ query: async () => {} }),
      passwordHasher: async () => 'hash',
      tokenSigner: () => 'token',
    });

    await service.registerOrganization({
      organizationName: 'Org',
      firstName: 'A',
      lastName: 'B',
      email: 'test@example.com',
      password: 'StrongPass123!',
      timezone: 'America/New_York',
    });

    expect(observed.timezone).toBe('America/New_York');
  });
});
