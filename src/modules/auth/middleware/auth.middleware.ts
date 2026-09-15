import {
  TokenInvalidError,
  TokenExpiredError,
  TokenReusedError,
  SessionRevokedError,
} from '@modules/auth/domain/errors/AuthErrors';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { TokenProvider } from '@modules/auth/domain/services/TokenProvider';
import { AppError } from '@shared/errors/app-error';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { ERROR_CODES } from '@shared/errors/error-codes';
import { asyncHandler } from '@shared/http/response';
import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedPrincipal {
  id: string;
  email: string;
  roles: string[];
  sessionId: string;
  correlationId: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedPrincipal;
  correlationId?: string;
}

export function createAuthMiddleware(
  tokenProvider: TokenProvider,
  tokenRepository: TokenRepository,
  sessionRepository: SessionRepository,
) {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppErrorFactory.unauthorized('Access token required');
    }

    const accessToken = authHeader.replace('Bearer ', '');

    let payload: Record<string, unknown>;
    try {
      payload = (await tokenProvider.verifyAccessToken(accessToken)) as Record<string, unknown>;
    } catch {
      throw new TokenExpiredError();
    }

    const tokenId = payload.jti as string;
    const tokenDoc = await tokenRepository.findByToken(accessToken);
    if (!tokenDoc || tokenDoc.isRevoked || tokenDoc.isUsed) {
      throw new TokenReusedError();
    }

    const session = await sessionRepository.findByTokenId(tokenId);
    if (!session || !session.isActive) {
      throw new SessionRevokedError();
    }

    req.user = {
      id: payload.sub as string,
      email: payload.email as string,
      roles: payload.roles as string[],
      sessionId: session.id,
      correlationId: req.correlationId ?? '',
    };

    next();
  });
}

export function requireRole(...roles: string[]) {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles ?? [];
    const hasRole = roles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new AppError({ code: ERROR_CODES.FORBIDDEN, message: 'Insufficient permissions' });
    }
    next();
  });
}
