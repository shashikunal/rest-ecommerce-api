import type { Logger } from '@config/logger';
import { UserNotFoundError } from '@modules/auth/domain/errors/AuthErrors';
import type { AuthEventPublisher } from '@modules/auth/domain/events/AuthEventPublisher';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { UserRepository } from '@modules/auth/domain/repositories/UserRepository';
import { assertAccountUsable } from '@modules/users/domain/entities/UserProfile';
import { SessionNotFoundError } from '@modules/users/domain/errors/UserErrors';

import { toSessionDTO, type SessionListResult } from './SessionDTO';

export interface RevokeResult {
  revoked: boolean;
  alreadyRevoked: boolean;
}

export interface RevokeOthersResult {
  revokedCount: number;
  currentSessionId: string;
}

export class SessionService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly eventPublisher: AuthEventPublisher,
    private readonly logger: Logger,
  ) {}

  async listSessions(
    userId: string,
    currentSessionId: string,
    options: { limit?: number; cursor?: string | null },
    correlationId?: string,
  ): Promise<SessionListResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UserNotFoundError('User not found', correlationId);
    assertAccountUsable(user, correlationId);

    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const { sessions, nextCursor } = await this.sessionRepository.findActiveByUserIdPaginated(
      userId,
      { limit, cursor: options.cursor ?? null },
    );
    return {
      data: sessions.map((s) => toSessionDTO(s, currentSessionId)),
      pagination: { limit, nextCursor, hasMore: nextCursor !== null },
    };
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    correlationId?: string,
  ): Promise<RevokeResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UserNotFoundError('User not found', correlationId);
    assertAccountUsable(user, correlationId);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundError('Session not found', correlationId);
    }
    if (!session.isActive) {
      return { revoked: true, alreadyRevoked: true };
    }

    await this.sessionRepository.revokeById(sessionId);
    await this.tokenRepository.revokeToken(session.tokenId).catch(() => undefined);
    if (session.refreshTokenId) {
      await this.tokenRepository.revokeToken(session.refreshTokenId).catch(() => undefined);
    }

    this.logger.info('Session revoked', { userId, sessionId, correlationId });
    await this.eventPublisher.publish({
      type: 'SESSION_REVOKED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: correlationId ?? '',
      metadata: { sessionId },
    });
    return { revoked: true, alreadyRevoked: false };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    correlationId?: string,
  ): Promise<RevokeOthersResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UserNotFoundError('User not found', correlationId);
    assertAccountUsable(user, correlationId);

    const current = await this.sessionRepository.findById(currentSessionId);
    if (!current || current.userId !== userId || !current.isActive) {
      throw new SessionNotFoundError('Current session not found', correlationId);
    }

    const revokedCount = await this.sessionRepository.revokeAllExcept(userId, currentSessionId);

    this.logger.info('Other sessions revoked', { userId, revokedCount, correlationId });
    await this.eventPublisher.publish({
      type: 'ALL_SESSIONS_REVOKED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: correlationId ?? '',
      metadata: { revokedCount, keptSessionId: currentSessionId },
    });
    return { revokedCount, currentSessionId };
  }
}
