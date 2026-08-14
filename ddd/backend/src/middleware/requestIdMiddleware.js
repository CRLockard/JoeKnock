import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req, res, next) {
  const requestId = randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}
