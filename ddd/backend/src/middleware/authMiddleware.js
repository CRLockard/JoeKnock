import { AppError, AuthError } from '../common/errors.js';
import { query } from '../db/client.js';
import { verifyAccessToken } from '../auth/jwt.js';

const ALLOWED_ROLES = new Set(['rep', 'manager', 'admin']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateClaims(payload) {
  // Claims are validated defensively even after signature verification so
  // downstream code can trust req.auth shape and role semantics.
  if (!isNonEmptyString(payload?.sub)) {
    throw new AuthError('Token is missing a valid subject claim.');
  }

  if (!isNonEmptyString(payload?.organizationId)) {
    throw new AuthError('Token is missing a valid organization claim.');
  }

  if (!isNonEmptyString(payload?.role) || !ALLOWED_ROLES.has(payload.role)) {
    throw new AuthError('Token is missing a valid role claim.');
  }

  return {
    userId: payload.sub,
    organizationId: payload.organizationId,
    role: payload.role,
  };
}

// Signature/claims check only. Does not consult the database, so it must not
// guard data routes; use authMiddleware for that.
export function verifyTokenClaimsMiddleware(req, res, next) {
  void res;
  const header = req.get('authorization');

  if (!header) {
    return next(new AuthError('Missing Authorization header.'));
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AuthError('Authorization header must use Bearer token.'));
  }

  try {
    const payload = verifyAccessToken(token);
    // req.auth is the canonical identity context used for organization
    // scoping and authorization; handlers must not trust client-supplied ids.
    req.auth = validateClaims(payload);
    return next();
  } catch (error) {
    if (error instanceof AuthError) {
      return next(error);
    }

    return next(new AuthError('Invalid or expired token.'));
  }
}

const CURRENT_USER_SQL = `
  SELECT id, organization_id, role, is_active
  FROM users
  WHERE id = $1 AND organization_id = $2
  LIMIT 1
`;

async function findCurrentUser({ userId, organizationId }) {
  const result = await query(CURRENT_USER_SQL, [userId, organizationId]);
  return result.rows[0] ?? null;
}

// Verifies the token, then re-checks the account against the database on every
// request so deactivation and role changes take effect immediately instead of
// at token expiry. req.auth.role is the current database role, not the claim.
export function createAuthMiddleware({ findUser = findCurrentUser } = {}) {
  return function authMiddleware(req, res, next) {
    verifyTokenClaimsMiddleware(req, res, async (claimsError) => {
      if (claimsError) {
        return next(claimsError);
      }

      try {
        const user = await findUser({
          userId: req.auth.userId,
          organizationId: req.auth.organizationId,
        });

        if (!user) {
          return next(new AuthError('Invalid or expired token.'));
        }

        if (!user.is_active) {
          return next(new AppError(403, 'FORBIDDEN', 'Account is inactive.'));
        }

        if (!ALLOWED_ROLES.has(user.role)) {
          return next(new AuthError('Invalid or expired token.'));
        }

        req.auth = { ...req.auth, role: user.role };
        return next();
      } catch (error) {
        // Non-UUID subject/organization claims cannot match any account.
        if (error?.code === '22P02') {
          return next(new AuthError('Invalid or expired token.'));
        }

        return next(error);
      }
    });
  };
}

export const authMiddleware = createAuthMiddleware();
