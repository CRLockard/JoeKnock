export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(401, 'UNAUTHENTICATED', message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request data.', details = []) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}
