import { AppError } from '@shared/errors/app-error';
import type { ErrorDetails } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class TokenExpiredError extends AppError {
  constructor(message = 'Access token has expired', correlationId?: string) {
    super({ code: ERROR_CODES.TOKEN_EXPIRED, message, correlationId });
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends AppError {
  constructor(message = 'Invalid token', correlationId?: string) {
    super({ code: ERROR_CODES.TOKEN_INVALID, message, correlationId });
    this.name = 'TokenInvalidError';
  }
}

export class TokenReusedError extends AppError {
  constructor(message = 'Refresh token has been reused', correlationId?: string) {
    super({ code: ERROR_CODES.TOKEN_REUSED, message, correlationId });
    this.name = 'TokenReusedError';
  }
}

export class SessionRevokedError extends AppError {
  constructor(message = 'Session has been revoked', correlationId?: string) {
    super({ code: ERROR_CODES.SESSION_REVOKED, message, correlationId });
    this.name = 'SessionRevokedError';
  }
}

export class EmailAlreadyVerifiedError extends AppError {
  constructor(message = 'Email is already verified', correlationId?: string) {
    super({ code: ERROR_CODES.EMAIL_ALREADY_VERIFIED, message, correlationId });
    this.name = 'EmailAlreadyVerifiedError';
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor(message = 'Email is not verified', correlationId?: string) {
    super({ code: ERROR_CODES.EMAIL_NOT_VERIFIED, message, correlationId });
    this.name = 'EmailNotVerifiedError';
  }
}

export class OtpExpiredError extends AppError {
  constructor(message = 'OTP has expired', correlationId?: string) {
    super({ code: ERROR_CODES.OTP_EXPIRED, message, correlationId });
    this.name = 'OtpExpiredError';
  }
}

export class OtpMaxAttemptsError extends AppError {
  constructor(message = 'Maximum OTP attempts exceeded', correlationId?: string) {
    super({ code: ERROR_CODES.OTP_MAX_ATTEMPTS, message, correlationId });
    this.name = 'OtpMaxAttemptsError';
  }
}

export class PasswordTooWeakError extends AppError {
  constructor(message = 'Password does not meet strength requirements', correlationId?: string) {
    super({ code: ERROR_CODES.PASSWORD_TOO_WEAK, message, correlationId });
    this.name = 'PasswordTooWeakError';
  }
}

export class PasswordMismatchError extends AppError {
  constructor(message = 'Password does not match', correlationId?: string) {
    super({ code: ERROR_CODES.PASSWORD_MISMATCH, message, correlationId });
    this.name = 'PasswordMismatchError';
  }
}

export class RefreshTokenRevokedError extends AppError {
  constructor(message = 'Refresh token has been revoked', correlationId?: string) {
    super({ code: ERROR_CODES.REFRESH_TOKEN_REVOKED, message, correlationId });
    this.name = 'RefreshTokenRevokedError';
  }
}

export class AccountLockedError extends AppError {
  constructor(
    message = 'Account is locked due to too many failed attempts',
    correlationId?: string,
  ) {
    super({ code: ERROR_CODES.ACCOUNT_LOCKED, message, correlationId });
    this.name = 'AccountLockedError';
  }
}

export class MaxSessionsReachedError extends AppError {
  constructor(message = 'Maximum number of sessions reached', correlationId?: string) {
    super({ code: ERROR_CODES.MAX_SESSIONS_REACHED, message, correlationId });
    this.name = 'MaxSessionsReachedError';
  }
}

export class UserNotFoundError extends AppError {
  constructor(message = 'User not found', correlationId?: string) {
    super({ code: ERROR_CODES.USER_NOT_FOUND, message, correlationId });
    this.name = 'UserNotFoundError';
  }
}

export class UserAlreadyExistsError extends AppError {
  constructor(message = 'User already exists', correlationId?: string) {
    super({ code: ERROR_CODES.USER_ALREADY_EXISTS, message, correlationId });
    this.name = 'UserAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Invalid email or password', correlationId?: string) {
    super({ code: ERROR_CODES.INVALID_CREDENTIALS, message, correlationId });
    this.name = 'InvalidCredentialsError';
  }
}

export class TokenRevokedError extends AppError {
  constructor(message = 'Token has been revoked', correlationId?: string) {
    super({ code: ERROR_CODES.TOKEN_REVOKED, message, correlationId });
    this.name = 'TokenRevokedError';
  }
}
