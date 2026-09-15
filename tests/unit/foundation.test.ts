import { describe, it, expect } from 'vitest';

import { envSchema, resetEnvCache } from '../../src/config/env';
import { AppError, RateLimitError, ValidationError } from '../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../src/shared/errors/error-codes';
import { formatErrorResponse } from '../../src/shared/errors/error-response';
import { HTTP_STATUS } from '../../src/shared/errors/http-status';
import {
  generateCorrelationId,
  validateCorrelationId,
} from '../../src/shared/security/correlation-id';
import { parsePagination } from '../../src/shared/types';
import { getClock, setClock, resetClock, getExpiryDate } from '../../src/shared/utils/clock';
import { isUUID } from '../../src/shared/utils/helpers';

describe('AppError', () => {
  it('should create AppError with correct properties', () => {
    const error = new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
    });
    expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });
});

describe('Correlation ID', () => {
  it('should generate a valid UUID', () => {
    const id = generateCorrelationId();
    expect(validateCorrelationId(id)).toBe(true);
  });
});

describe('Utilities', () => {
  it('should check UUID format', () => {
    expect(isUUID('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    expect(isUUID('not-a-uuid')).toBe(false);
  });
});

describe('Pagination', () => {
  it('should parse pagination params', () => {
    const result = parsePagination({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('should clamp limit to max', () => {
    const result = parsePagination({ limit: '9999' }, 20, 50);
    expect(result.limit).toBe(50);
  });
});

describe('Error contract', () => {
  it('should format errors without leaking internals', () => {
    const error = new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Bad',
      correlationId: 'cid',
    });
    const body = formatErrorResponse(error);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.correlationId).toBe('cid');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('should map rate-limit to 429 with retryAfter', () => {
    const error = new RateLimitError('Slow down', 42, 'cid');
    expect(error.statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect(error.details.retryAfter).toBe(42);
  });

  it('should create ValidationError as 400', () => {
    const error = new ValidationError('Invalid', { field_0: 'x' });
    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });
});

describe('Correlation ID validation', () => {
  it('should reject non-UUID values', () => {
    expect(validateCorrelationId('not-valid')).toBe(false);
    expect(validateCorrelationId('x'.repeat(65))).toBe(false);
  });
});

describe('Clock abstraction', () => {
  it('should allow injecting a fixed clock', () => {
    const fixed = new Date('2026-01-01T00:00:00.000Z');
    setClock({ now: () => fixed, nowMs: () => fixed.getTime(), isoNow: () => fixed.toISOString() });
    expect(getClock().isoNow()).toBe('2026-01-01T00:00:00.000Z');
    expect(getExpiryDate(60).toISOString()).toBe('2026-01-01T00:01:00.000Z');
    resetClock();
    expect(getClock().now() instanceof Date).toBe(true);
  });
});

describe('Env validation', () => {
  it('should fail fast on missing secrets', () => {
    resetEnvCache();
    const result = envSchema.safeParse({
      MONGODB_URI: '',
      REDIS_URL: '',
      KAFKA_BROKERS: '',
      KAFKA_CLIENT_ID: '',
      KAFKA_GROUP_ID: '',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
    });
    expect(result.success).toBe(false);
    resetEnvCache();
  });
});
