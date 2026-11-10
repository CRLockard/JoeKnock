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

function forbiddenError(message) {
  return new AppError(403, 'FORBIDDEN', message);
}

function parseActiveFilter(active) {
  if (active === undefined) {
    return undefined;
  }

  // Query-string booleans are normalized once so repository stays typed.
  return active === 'true';
}

function hasAnyUpdatableField({ firstName, lastName, role }) {
  return (
    firstName !== undefined || lastName !== undefined || role !== undefined
  );
}

async function lockOrganizationUsers(client, organizationId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1), 2)', [
    organizationId,
  ]);
}

async function protectLastAdmin(client, organizationId, target) {
  if (target.role !== 'admin' || !target.is_active) return;
  const result = await client.query(
    "SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1 AND role = 'admin' AND is_active = true",
    [organizationId],
  );
  if (result.rows[0].count <= 1) {
    throw new AppError(
      409,
      'CONFLICT',
      'Assign another active administrator before deactivating or demoting the last administrator.',
    );
  }
}

export function createUsersService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
  passwordHasher = hashPassword,
} = {}) {
  return {
    async setUserActiveStatus({ organizationId, userId, isActive }) {
      const updatedUser = await runInTransaction(async (client) => {
        await lockOrganizationUsers(client, organizationId);
        const target = await repository.findUserForUpdate(client, {
          organizationId,
          userId,
        });
        if (!target) return null;
        if (!isActive) await protectLastAdmin(client, organizationId, target);
        return repository.setUserActiveStatus(client, {
          organizationId,
          userId,
          isActive,
        });
      });

      if (!updatedUser) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
      }

      return toPublicUser(updatedUser);
    },

    async updateUser({
      organizationId,
      userId,
      firstName,
      lastName,
      role,
      actorRole,
    }) {
      if (!hasAnyUpdatableField({ firstName, lastName, role })) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'At least one updatable field is required.',
        );
      }

      const updatedUser = await runInTransaction(async (client) => {
        await lockOrganizationUsers(client, organizationId);
        const target = await repository.findUserForUpdate(client, {
          organizationId,
          userId,
        });
        if (!target) return null;
        if (actorRole !== 'admin') {
          // Only admins may change roles; managers may only rename reps.
          if (role !== undefined) {
            throw forbiddenError('Only administrators can change user roles.');
          }

          if (target.role !== 'rep') {
            throw forbiddenError(
              'Only administrators can modify manager or admin accounts.',
            );
          }
        }

        if (role !== undefined && role !== 'admin')
          await protectLastAdmin(client, organizationId, target);

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
      actorRole,
    }) {
      if (actorRole !== 'admin' && role !== 'rep') {
        throw forbiddenError(
          'Only administrators can create manager or admin accounts.',
        );
      }

      try {
        const createdUser = await runInTransaction(async (client) => {
          // Password hashing occurs server-side only; hash never leaves backend.
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
          // Unique(email, organization) collisions surface as domain conflict.
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
