import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { hashPassword } from '../auth/password.js';
import { usersRepository as defaultRepository } from './usersRepository.js';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function toPublicUser(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isUniqueViolation(error) {
  return error && error.code === '23505';
}

function parseActiveFilter(active) {
  if (active === undefined) {
    return undefined;
  }

  return active === 'true';
}

function hasAnyUpdatableField({ firstName, lastName, role }) {
  return (
    firstName !== undefined || lastName !== undefined || role !== undefined
  );
}

export function createUsersService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
  passwordHasher = hashPassword,
} = {}) {
  return {
    async updateUser({ organizationId, userId, firstName, lastName, role }) {
      if (!hasAnyUpdatableField({ firstName, lastName, role })) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'At least one updatable field is required.',
        );
      }

      const updatedUser = await runInTransaction(async (client) => {
        return repository.updateUser(client, {
          organizationId,
          userId,
          firstName,
          lastName,
          role,
        });
      });

      if (!updatedUser) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
      }

      return toPublicUser(updatedUser);
    },

    async listUsers({ organizationId, active, role }) {
      const rows = await runInTransaction(async (client) => {
        return repository.listUsers(client, {
          organizationId,
          active: parseActiveFilter(active),
          role,
        });
      });

      return rows.map(toPublicUser);
    },

    async createUser({
      organizationId,
      firstName,
      lastName,
      email,
      password,
      role,
    }) {
      try {
        const createdUser = await runInTransaction(async (client) => {
          const passwordHash = await passwordHasher(password);

          return repository.createUser(client, {
            organizationId,
            email: normalizeEmail(email),
            passwordHash,
            firstName,
            lastName,
            role,
            isActive: true,
          });
        });

        return toPublicUser(createdUser);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            409,
            'CONFLICT',
            'A user with this email already exists for this organization.',
          );
        }

        throw error;
      }
    },
  };
}
