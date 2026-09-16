import { ERROR_CODES, type ErrorCode } from './error-codes';
import { HTTP_STATUS } from './http-status';

export interface ErrorDetails {
  [key: string]: unknown;
}

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  details?: ErrorDetails;
  statusCode?: number;
  cause?: Error;
  correlationId?: string;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: ErrorDetails;
  public readonly correlationId: string | undefined;
  public readonly isOperational: boolean;
  public readonly isProduction: boolean;

  constructor(options: AppErrorOptions) {
    const statusCode = options.statusCode ?? AppError.defaultStatusCode(options.code);
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = statusCode;
    this.details = options.details ?? {};
    this.correlationId = options.correlationId;
    this.isOperational = options.isOperational ?? true;
    this.isProduction = process.env.NODE_ENV === 'production';

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  private static defaultStatusCode(code: ErrorCode): number {
    const codeToStatus: Record<ErrorCode, number> = {
      [ERROR_CODES.VALIDATION_ERROR]: HTTP_STATUS.BAD_REQUEST,
      [ERROR_CODES.UNAUTHORIZED]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.FORBIDDEN]: HTTP_STATUS.FORBIDDEN,
      [ERROR_CODES.NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.CONFLICT]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.UNPROCESSABLE]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.RATE_LIMITED]: HTTP_STATUS.TOO_MANY_REQUESTS,
      [ERROR_CODES.INVALID_CORRELATION_ID]: HTTP_STATUS.BAD_REQUEST,
      [ERROR_CODES.IDEMPOTENCY_CONFLICT]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.INVALID_CURSOR]: HTTP_STATUS.BAD_REQUEST,
      [ERROR_CODES.TOKEN_EXPIRED]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.TOKEN_INVALID]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.TOKEN_REUSED]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.SESSION_REVOKED]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.EMAIL_ALREADY_VERIFIED]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.EMAIL_NOT_VERIFIED]: HTTP_STATUS.FORBIDDEN,
      [ERROR_CODES.OTP_EXPIRED]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.OTP_MAX_ATTEMPTS]: HTTP_STATUS.TOO_MANY_REQUESTS,
      [ERROR_CODES.PASSWORD_TOO_WEAK]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.PASSWORD_MISMATCH]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.REFRESH_TOKEN_REVOKED]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.ACCOUNT_LOCKED]: HTTP_STATUS.TOO_MANY_REQUESTS,
      [ERROR_CODES.MAX_SESSIONS_REACHED]: HTTP_STATUS.FORBIDDEN,
      [ERROR_CODES.USER_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.USER_ALREADY_EXISTS]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.INVALID_CREDENTIALS]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.TOKEN_REVOKED]: HTTP_STATUS.UNAUTHORIZED,
      [ERROR_CODES.USER_SUSPENDED]: HTTP_STATUS.FORBIDDEN,
      [ERROR_CODES.USER_DEACTIVATED]: HTTP_STATUS.FORBIDDEN,
      [ERROR_CODES.SESSION_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.SESSION_ALREADY_REVOKED]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.FORBIDDEN_RESOURCE]: HTTP_STATUS.FORBIDDEN,
      [ERROR_CODES.INVALID_PROFILE]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.CONCURRENT_UPDATE]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.PRODUCT_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.VARIANT_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.CATEGORY_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.BRAND_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.SKU_EXISTS]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.SLUG_EXISTS]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.INVALID_TRANSITION]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.CATEGORY_IN_USE]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.INVALID_CATEGORY]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.PRODUCT_NOT_PUBLISHABLE]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.INVENTORY_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.INSUFFICIENT_STOCK]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.RESERVATION_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.INVALID_RESERVATION_STATE]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.CHECKOUT_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
      [ERROR_CODES.CHECKOUT_CONFLICT]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.CHECKOUT_EXPIRED]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.CART_EMPTY]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.CART_CHANGED]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.PRICE_CHANGED]: HTTP_STATUS.CONFLICT,
      [ERROR_CODES.ITEM_UNAVAILABLE]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      [ERROR_CODES.INTERNAL]: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      [ERROR_CODES.BAD_GATEWAY]: HTTP_STATUS.BAD_GATEWAY,
      [ERROR_CODES.SERVICE_UNAVAILABLE]: HTTP_STATUS.SERVICE_UNAVAILABLE,
      [ERROR_CODES.TIMEOUT]: HTTP_STATUS.GATEWAY_TIMEOUT,
      [ERROR_CODES.DEPENDENCY_UNAVAILABLE]: HTTP_STATUS.SERVICE_UNAVAILABLE,
      [ERROR_CODES.DB_ERROR]: HTTP_STATUS.SERVICE_UNAVAILABLE,
      [ERROR_CODES.REDIS_ERROR]: HTTP_STATUS.SERVICE_UNAVAILABLE,
      [ERROR_CODES.KAFKA_ERROR]: HTTP_STATUS.SERVICE_UNAVAILABLE,
      [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: HTTP_STATUS.BAD_GATEWAY,
      [ERROR_CODES.UNKNOWN]: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    };

    return codeToStatus[code] ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: ErrorDetails, correlationId?: string) {
    super({
      code: ERROR_CODES.VALIDATION_ERROR,
      message,
      details,
      correlationId,
    });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', correlationId?: string) {
    super({
      code: ERROR_CODES.UNAUTHORIZED,
      message,
      correlationId,
    });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied', correlationId?: string) {
    super({
      code: ERROR_CODES.FORBIDDEN,
      message,
      correlationId,
    });
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', correlationId?: string) {
    super({
      code: ERROR_CODES.NOT_FOUND,
      message,
      correlationId,
    });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', correlationId?: string) {
    super({
      code: ERROR_CODES.CONFLICT,
      message,
      correlationId,
    });
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter: number, correlationId?: string) {
    super({
      code: ERROR_CODES.RATE_LIMITED,
      message,
      details: { retryAfter },
      correlationId,
    });
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, correlationId?: string) {
    super({
      code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      message,
      details: { service },
      correlationId,
    });
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', correlationId?: string, cause?: Error) {
    super({
      code: ERROR_CODES.DB_ERROR,
      message,
      correlationId,
      cause,
      isOperational: false,
    });
    this.name = 'DatabaseError';
  }
}

export class InfrastructureError extends AppError {
  constructor(message = 'Infrastructure error', correlationId?: string, cause?: Error) {
    super({
      code: ERROR_CODES.INTERNAL,
      message,
      correlationId,
      cause,
      isOperational: false,
    });
    this.name = 'InfrastructureError';
  }
}
