import type { Response, NextFunction, Request } from 'express';

import { AppError } from '../errors/app-error';
import { ERROR_CODES } from '../errors/error-codes';
import { asyncHandler } from '../http/response';

import { hasAnyRole, hasPermission, type Permission } from './permissions';

export interface AuthorizedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    sessionId: string;
    correlationId: string;
  };
  correlationId?: string;
}

export function requireRole(...roles: string[]) {
  return asyncHandler(async (req: AuthorizedRequest, _res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles ?? [];
    if (!hasAnyRole(userRoles, roles)) {
      throw new AppError({ code: ERROR_CODES.FORBIDDEN, message: 'Insufficient permissions' });
    }
    next();
  });
}

export function requirePermission(...permissions: Permission[]) {
  return asyncHandler(async (req: AuthorizedRequest, _res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles ?? [];
    const allowed = permissions.some((p) => hasPermission(userRoles, p));
    if (!allowed) {
      throw new AppError({ code: ERROR_CODES.FORBIDDEN, message: 'Insufficient permissions' });
    }
    next();
  });
}

export function assertOwnership(resourceUserId: string, principalUserId: string): void {
  if (resourceUserId !== principalUserId) {
    throw new AppError({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Access to this resource is forbidden',
    });
  }
}

export function assertOwnershipOrNotFound(
  resourceUserId: string | null | undefined,
  principalUserId: string,
): void {
  if (!resourceUserId || resourceUserId !== principalUserId) {
    throw new AppError({ code: ERROR_CODES.NOT_FOUND, message: 'Resource not found' });
  }
}
