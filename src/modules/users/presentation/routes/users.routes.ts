import type { Logger } from '@config/logger';
import type { AuthEventPublisher } from '@modules/auth/domain/events/AuthEventPublisher';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { UserRepository } from '@modules/auth/domain/repositories/UserRepository';
import type { OtpService } from '@modules/auth/domain/services/OtpService';
import { Router, type RequestHandler } from 'express';

import { UserService } from '../../application/UserService';
import { UsersController } from '../controllers/users.controller';
import {
  validateDeactivateAccount,
  validateRequestPhoneChange,
  validateUpdatePreferences,
  validateUpdateProfile,
  validateVerifyPhoneChange,
} from '../validators/user.validators';

export interface UserRouteDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  tokenRepository: TokenRepository;
  otpService: OtpService;
  eventPublisher: AuthEventPublisher;
  logger: Logger;
  authMiddleware: RequestHandler;
}

export function createUserRoutes(deps: UserRouteDeps): Router {
  const router = Router();
  const service = new UserService(
    deps.userRepository,
    deps.sessionRepository,
    deps.tokenRepository,
    deps.otpService,
    deps.eventPublisher,
    deps.logger,
  );
  const controller = new UsersController(service);

  router.get('/me', deps.authMiddleware, controller.getMe);
  router.patch('/me', deps.authMiddleware, validateUpdateProfile, controller.updateProfile);
  router.get('/me/preferences', deps.authMiddleware, controller.getPreferences);
  router.patch(
    '/me/preferences',
    deps.authMiddleware,
    validateUpdatePreferences,
    controller.updatePreferences,
  );
  router.post(
    '/me/phone/request',
    deps.authMiddleware,
    validateRequestPhoneChange,
    controller.requestPhoneChange,
  );
  router.post(
    '/me/phone/verify',
    deps.authMiddleware,
    validateVerifyPhoneChange,
    controller.verifyPhoneChange,
  );
  router.post(
    '/me/deactivate',
    deps.authMiddleware,
    validateDeactivateAccount,
    controller.deactivate,
  );

  return router;
}
