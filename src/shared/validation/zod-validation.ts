import type { Request, Response, NextFunction } from 'express';
import { type ZodTypeAny } from 'zod';

import { AppError } from '../errors/app-error';
import type { ErrorDetails } from '../errors/app-error';
import { ERROR_CODES } from '../errors/error-codes';
import { asyncHandler } from '../http/response';

function issuesToDetails(
  issues: Array<{ path: (string | number)[]; message: string; code?: string }>,
): ErrorDetails {
  const details: ErrorDetails = {};
  issues.forEach((issue, index) => {
    details[`field_${index}`] = {
      field: String(issue.path.join('.')),
      code: issue.code ?? 'INVALID',
      message: issue.message,
    };
  });
  return details;
}

export function validateRequest<T extends ZodTypeAny>(schema: T) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
    });
    if (!result.success) {
      throw new AppError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: issuesToDetails(result.error.issues),
      });
    }
    req.body = result.data.body;
    req.params = result.data.params;
    next();
  });
}

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new AppError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: issuesToDetails(result.error.issues),
      });
    }
    req.body = result.data;
    next();
  });
}

export function validateParams<T extends ZodTypeAny>(schema: T) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      throw new AppError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: issuesToDetails(result.error.issues),
      });
    }
    req.params = result.data;
    next();
  });
}

export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw new AppError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: issuesToDetails(result.error.issues),
      });
    }
    next();
  });
}
