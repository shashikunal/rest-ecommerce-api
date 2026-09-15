import type { Logger } from '@config/logger';
import type { AuthEventPublisher } from '@modules/auth/domain/events/AuthEventPublisher';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { UserRepository } from '@modules/auth/domain/repositories/UserRepository';
import type { Router, RequestHandler } from 'express';

import { SessionService } from './application/SessionService';
import { SessionsController } from './presentation/controllers/sessions.controller';
import { createSessionRoutes } from './presentation/routes/sessions.routes';

export interface SessionsSharedDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  tokenRepository: TokenRepository;
  eventPublisher: AuthEventPublisher;
  logger: Logger;
  authMiddleware: RequestHandler;
}

export interface SessionsDependencies {
  sessionService: SessionService;
  controller: SessionsController;
  sessionRoutes: Router;
}

export function createSessionsDependencies(shared: SessionsSharedDeps): SessionsDependencies {
  const sessionService = new SessionService(
    shared.userRepository,
    shared.sessionRepository,
    shared.tokenRepository,
    shared.eventPublisher,
    shared.logger,
  );
  const controller = new SessionsController(sessionService);
  const sessionRoutes = createSessionRoutes({
    userRepository: shared.userRepository,
    sessionRepository: shared.sessionRepository,
    tokenRepository: shared.tokenRepository,
    eventPublisher: shared.eventPublisher,
    logger: shared.logger,
    authMiddleware: shared.authMiddleware,
  });
  return { sessionService, controller, sessionRoutes };
}
