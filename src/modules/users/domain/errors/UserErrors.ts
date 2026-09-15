import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class UserSuspendedError extends AppError {
  constructor(message = 'Account is suspended', correlationId?: string) {
    super({ code: ERROR_CODES.USER_SUSPENDED, message, correlationId });
    this.name = 'UserSuspendedError';
  }
}

export class UserDeactivatedError extends AppError {
  constructor(message = 'Account is deactivated', correlationId?: string) {
    super({ code: ERROR_CODES.USER_DEACTIVATED, message, correlationId });
    this.name = 'UserDeactivatedError';
  }
}

export class SessionNotFoundError extends AppError {
  constructor(message = 'Session not found', correlationId?: string) {
    super({ code: ERROR_CODES.SESSION_NOT_FOUND, message, correlationId });
    this.name = 'SessionNotFoundError';
  }
}

export class SessionAlreadyRevokedError extends AppError {
  constructor(message = 'Session has already been revoked', correlationId?: string) {
    super({ code: ERROR_CODES.SESSION_ALREADY_REVOKED, message, correlationId });
    this.name = 'SessionAlreadyRevokedError';
  }
}

export class ForbiddenResourceError extends AppError {
  constructor(message = 'Access to this resource is forbidden', correlationId?: string) {
    super({ code: ERROR_CODES.FORBIDDEN_RESOURCE, message, correlationId });
    this.name = 'ForbiddenResourceError';
  }
}

export class InvalidProfileError extends AppError {
  constructor(
    message = 'Invalid profile data',
    details: Record<string, unknown> = {},
    correlationId?: string,
  ) {
    super({ code: ERROR_CODES.INVALID_PROFILE, message, details, correlationId });
    this.name = 'InvalidProfileError';
  }
}

export class ConcurrentUpdateError extends AppError {
  constructor(message = 'Resource was modified concurrently', correlationId?: string) {
    super({ code: ERROR_CODES.CONCURRENT_UPDATE, message, correlationId });
    this.name = 'ConcurrentUpdateError';
  }
}
