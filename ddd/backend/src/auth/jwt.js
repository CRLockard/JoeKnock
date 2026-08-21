import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken({ userId, organizationId, role }) {
  return jwt.sign(
    {
      // These claims are consumed by auth middleware to establish tenant and
      // authorization context for every protected request.
      organizationId,
      role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      subject: userId,
    },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
