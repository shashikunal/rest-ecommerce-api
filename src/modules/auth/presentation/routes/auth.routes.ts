import type { AuthService } from '@modules/auth/application/auth.service';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { TokenProvider } from '@modules/auth/domain/services/TokenProvider';
import { createAuthMiddleware, requireRole } from '@modules/auth/middleware/auth.middleware';
import { AuthController } from '@modules/auth/presentation/controllers/auth.controller';
import {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateSendOtp,
  validateVerifyEmail,
  validateResetPassword,
  validateChangePassword,
} from '@modules/auth/presentation/validators/auth.validators';
import { Router } from 'express';

export function createAuthRoutes(
  authService: AuthService,
  tokenProvider: TokenProvider,
  tokenRepository: TokenRepository,
  sessionRepository: SessionRepository,
) {
  const router = Router();
  const authMiddleware = createAuthMiddleware(tokenProvider, tokenRepository, sessionRepository);
  const controller = new AuthController(authService);

  router.post('/register', validateRegister, controller.register);
  router.post('/login', validateLogin, controller.login);
  router.post('/refresh', validateRefreshToken, controller.refresh);
  router.post('/logout', authMiddleware, controller.logout);
  router.post('/logout-all', authMiddleware, controller.logoutAll);
  router.post('/otp', validateSendOtp, controller.sendOtp);
  router.post('/verify-email', authMiddleware, validateVerifyEmail, controller.verifyEmail);
  router.post('/reset-password', validateResetPassword, controller.resetPassword);
  router.post(
    '/change-password',
    authMiddleware,
    validateChangePassword,
    controller.changePassword,
  );
  router.post('/sessions', authMiddleware, requireRole('admin'), (req: any, res: any) => {
    res.json({ message: 'Session management endpoint' });
  });

  return router;
}
