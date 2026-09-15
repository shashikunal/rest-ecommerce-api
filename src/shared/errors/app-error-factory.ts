import type { ErrorDetails } from './app-error';
import { AppError } from './app-error';
import { NotFoundError } from './app-error';
import { RateLimitError } from './app-error';
import { ConflictError } from './app-error';
import { ERROR_CODES, type ErrorCode } from './error-codes';

export class AppErrorFactory {
  static validation(
    field: string,
    detailMessage: string,
    code?: string,
    correlationId?: string,
  ): AppError {
    return new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: detailMessage,
      details: { field, code },
      correlationId,
    });
  }

  static validationFromZod(
    issues: Array<{ path: string[]; message: string; code?: string }>,
    correlationId?: string,
  ): AppError {
    const details: ErrorDetails = {};
    issues.forEach((issue, index) => {
      details[`field_${index}`] = {
        field: issue.path.join('.'),
        code: issue.code ?? 'INVALID',
        message: issue.message,
      };
    });

    return new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details,
      correlationId,
    });
  }

  static notFound(resource: string, id?: string, correlationId?: string): AppError {
    return new NotFoundError(`${resource}${id ? ` with id ${id}` : ''} not found`, correlationId);
  }

  static conflict(resource: string, reason: string, correlationId?: string): AppError {
    return new ConflictError(`${resource}: ${reason}`, correlationId);
  }

  static rateLimited(retryAfter: number, correlationId?: string): AppError {
    return new RateLimitError('Rate limit exceeded', retryAfter, correlationId);
  }

  static unauthorized(message = 'Authentication required', correlationId?: string): AppError {
    return new AppError({
      code: ERROR_CODES.UNAUTHORIZED,
      message,
      correlationId,
    });
  }

  static forbidden(message = 'Access denied', correlationId?: string): AppError {
    return new AppError({
      code: ERROR_CODES.FORBIDDEN,
      message,
      correlationId,
    });
  }

  static idempotencyConflict(correlationId?: string): AppError {
    return new AppError({
      code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
      message: 'Idempotency key conflict: same key with different body',
      correlationId,
    });
  }
}
