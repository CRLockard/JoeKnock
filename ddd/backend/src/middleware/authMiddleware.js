import { AuthError } from '../common/errors.js';
import { verifyAccessToken } from '../auth/jwt.js';

const ALLOWED_ROLES = new Set(['rep', 'manager', 'admin']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateClaims(payload) {
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

export function authMiddleware(req, res, next) {
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
    req.auth = validateClaims(payload);
    return next();
  } catch (error) {
    if (error instanceof AuthError) {
      return next(error);
    }

    return next(new AuthError('Invalid or expired token.'));
  }
}
