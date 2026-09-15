import type { AuthRequest } from '@modules/auth/middleware/auth.middleware';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler, sendSuccessResponse } from '@shared/http/response';
import type { Response } from 'express';

import type { SessionService } from '../../application/SessionService';

function requirePrincipal(req: AuthRequest): { userId: string; sessionId: string } {
  const userId = req.user?.id;
  const sessionId = req.user?.sessionId;
  if (!userId || !sessionId) throw AppErrorFactory.unauthorized('Authentication required');
  return { userId, sessionId };
}

export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  list = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, sessionId } = requirePrincipal(req);
    const limit = Number(req.query.limit ?? 20);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
    const result = await this.sessionService.listSessions(
      userId,
      sessionId,
      { limit: Number.isFinite(limit) ? limit : 20, cursor },
      req.correlationId,
    );
    sendSuccessResponse(res, { sessions: result.data, pagination: result.pagination });
  });

  revoke = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = requirePrincipal(req);
    const result = await this.sessionService.revokeSession(
      userId,
      req.params.sessionId as string,
      req.correlationId,
    );
    sendSuccessResponse(res, { revoked: result.revoked, alreadyRevoked: result.alreadyRevoked });
  });

  revokeOthers = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, sessionId } = requirePrincipal(req);
    const result = await this.sessionService.revokeOtherSessions(
      userId,
      sessionId,
      req.correlationId,
    );
    sendSuccessResponse(res, {
      revokedCount: result.revokedCount,
      currentSessionId: result.currentSessionId,
    });
  });
}
