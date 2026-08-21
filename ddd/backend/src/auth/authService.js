import { AppError, AuthError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { signAccessToken } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';
import { authRepository as defaultRepository } from './authRepository.js';

const DEFAULT_REP_VISIBILITY = 'own';
const DEFAULT_ROLE = 'admin';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function toPublicUser(user) {
  return {
    id: user.id,
    organizationId: user.organization_id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
  };
}

function isUniqueViolation(error) {
  return error && error.code === '23505';
}

function invalidCredentialsError() {
  return new AuthError('Invalid email or password.');
}

function invalidAuthContextError() {
  return new AuthError('Invalid or expired token.');
}

export function createAuthService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
  passwordHasher = hashPassword,
  tokenSigner = signAccessToken,
  passwordVerifier = verifyPassword,
  onOrganizationCreated = async () => {},
} = {}) {
  return {
    async getCurrentUser({ userId, organizationId }) {
      const user = await runInTransaction(async (client) => {
        return repository.findUserByIdAndOrganization(client, {
          userId,
          organizationId,
        });
      });

      // The authenticated principal must still resolve to an organization-
      // scoped user row. Missing rows indicate stale or invalid auth context.
      if (!user) {
        throw invalidAuthContextError();
      }

      if (!user.is_active) {
        throw new AppError(403, 'FORBIDDEN', 'Account is inactive.');
      }

      return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        teams: [],
      };
    },

    async login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = await runInTransaction(async (client) => {
        return repository.findUserByEmail(client, {
          email: normalizedEmail,
        });
      });

      if (!user) {
        throw invalidCredentialsError();
      }

      const passwordMatches = await passwordVerifier(
        user.password_hash,
        password,
      );

      if (!passwordMatches) {
        throw invalidCredentialsError();
      }

      if (!user.is_active) {
        throw new AppError(403, 'FORBIDDEN', 'Account is inactive.');
      }

      const publicUser = toPublicUser(user);
      // JWT includes only claims required for identity + authorization context;
      // richer profile data continues to come from organization-scoped queries.
      const token = tokenSigner({
        userId: publicUser.id,
        organizationId: publicUser.organizationId,
        role: publicUser.role,
      });

      return {
        token,
        user: publicUser,
      };
    },

    async registerOrganization({
      organizationName,
      firstName,
      lastName,
      email,
      password,
      timezone,
    }) {
      try {
        const result = await runInTransaction(async (client) => {
          // Registration bootstraps the tenant boundary first, then settings,
          // then the initial admin user, all in one transaction.
          const organization = await repository.createOrganization(client, {
            name: organizationName,
          });

          await onOrganizationCreated({ client, organization });

          await repository.createOrganizationSettings(client, {
            organizationId: organization.id,
            repVisibility: DEFAULT_REP_VISIBILITY,
            timezone,
          });

          const passwordHash = await passwordHasher(password);

          const user = await repository.createUser(client, {
            organizationId: organization.id,
            email: normalizeEmail(email),
            passwordHash,
            firstName,
            lastName,
            role: DEFAULT_ROLE,
            isActive: true,
          });

          return {
            organization,
            user,
          };
        });

        const user = toPublicUser(result.user);
        const token = tokenSigner({
          userId: user.id,
          organizationId: user.organizationId,
          role: user.role,
        });

        return {
          token,
          user,
        };
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
