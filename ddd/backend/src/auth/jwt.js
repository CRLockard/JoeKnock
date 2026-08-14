import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken({ userId, organizationId, role }) {
  return jwt.sign(
    {
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
