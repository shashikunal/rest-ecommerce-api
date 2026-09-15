import type { Logger } from '@config/logger';
import type { AuthEventPublisher } from '@modules/auth/domain/events/AuthEventPublisher';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { UserRepository } from '@modules/auth/domain/repositories/UserRepository';
import {
  validateSessionIdParam,
  validateSessionListQuery,
} from '@modules/users/presentation/validators/user.validators';
import { Router, type RequestHandler } from 'express';

import { SessionService } from '../../application/SessionService';
import { SessionsController } from '../controllers/sessions.controller';

export interface SessionRouteDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  tokenRepository: TokenRepository;
  eventPublisher: AuthEventPublisher;
  logger: Logger;
  authMiddleware: RequestHandler;
}

export function createSessionRoutes(deps: SessionRouteDeps): Router {
  const router = Router();
  const service = new SessionService(
    deps.userRepository,
    deps.sessionRepository,
    deps.tokenRepository,
    deps.eventPublisher,
    deps.logger,
  );
  const controller = new SessionsController(service);

  router.get('/', deps.authMiddleware, validateSessionListQuery, controller.list);
  router.post('/revoke-others', deps.authMiddleware, controller.revokeOthers);
  router.delete('/:sessionId', deps.authMiddleware, validateSessionIdParam, controller.revoke);

  return router;
}
