import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { signAccessToken } from './jwt.js';
import { hashPassword } from './password.js';
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

export function createAuthService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
  passwordHasher = hashPassword,
  tokenSigner = signAccessToken,
  onOrganizationCreated = async () => {},
} = {}) {
  return {
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
