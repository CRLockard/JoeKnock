import { AppError } from '../common/errors.js';
import { sendError } from '../common/response.js';
import { logger } from '../common/logger.js';

export function notFoundMiddleware(req, res) {
  return sendError(res, {
    statusCode: 404,
    code: 'RESOURCE_NOT_FOUND',
    message: 'Resource not found.',
    requestId: req.requestId,
  });
}

export function errorMiddleware(err, req, res, next) {
  void next;

  // Domain/application errors are already classified and safe to return.
  if (err instanceof AppError) {
    return sendError(res, {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      requestId: req.requestId,
    });
  }

  logger.error('Unhandled error', {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    error: err?.message,
  });

  // Unknown failures are intentionally generalized to avoid leaking internals.
  return sendError(res, {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
    requestId: req.requestId,
  });
}
