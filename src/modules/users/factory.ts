import type { Logger } from '@config/logger';
import type { AuthEventPublisher } from '@modules/auth/domain/events/AuthEventPublisher';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { UserRepository } from '@modules/auth/domain/repositories/UserRepository';
import type { OtpService } from '@modules/auth/domain/services/OtpService';
import type { Router, RequestHandler } from 'express';

import { UserService } from './application/UserService';
import { UsersController } from './presentation/controllers/users.controller';
import { createUserRoutes } from './presentation/routes/users.routes';

export interface UsersSharedDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  tokenRepository: TokenRepository;
  otpService: OtpService;
  eventPublisher: AuthEventPublisher;
  logger: Logger;
  authMiddleware: RequestHandler;
}

export interface UsersDependencies {
  userService: UserService;
  controller: UsersController;
  userRoutes: Router;
}

export function createUsersDependencies(shared: UsersSharedDeps): UsersDependencies {
  const userService = new UserService(
    shared.userRepository,
    shared.sessionRepository,
    shared.tokenRepository,
    shared.otpService,
    shared.eventPublisher,
    shared.logger,
  );
  const controller = new UsersController(userService);
  const userRoutes = createUserRoutes({
    userRepository: shared.userRepository,
    sessionRepository: shared.sessionRepository,
    tokenRepository: shared.tokenRepository,
    otpService: shared.otpService,
    eventPublisher: shared.eventPublisher,
    logger: shared.logger,
    authMiddleware: shared.authMiddleware,
  });
  return { userService, controller, userRoutes };
}
