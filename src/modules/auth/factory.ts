import type { EnvConfig } from '../../config/env';
import type { Logger } from '../../config/logger';

import { AuthService } from './application/auth.service';
import { Argon2PasswordHasher } from './infrastructure/adapters/Argon2PasswordHasher';
import { InMemoryEventPublisher } from './infrastructure/adapters/InMemoryEventPublisher';
import { JwtTokenProvider } from './infrastructure/adapters/JwtTokenProvider';
import { RedisOtpService } from './infrastructure/adapters/RedisOtpService';
import { MongoSessionRepository } from './infrastructure/database/session.repository';
import { MongoTokenRepository } from './infrastructure/database/token.repository';
import { MongoUserRepository } from './infrastructure/database/user.repository';
import { createAuthMiddleware } from './middleware/auth.middleware';
import { AuthController } from './presentation/controllers/auth.controller';
import { createAuthRoutes } from './presentation/routes/auth.routes';

export function createAuthDependencies(config: EnvConfig, logger: Logger) {
  const userRepository = new MongoUserRepository(logger);
  const sessionRepository = new MongoSessionRepository(logger);
  const tokenRepository = new MongoTokenRepository(logger);
  const passwordHasher = new Argon2PasswordHasher(logger);
  const tokenProvider = new JwtTokenProvider(config, logger);
  const otpService = new RedisOtpService(logger);
  const eventPublisher = new InMemoryEventPublisher(logger);

  const authService = new AuthService(
    userRepository,
    sessionRepository,
    tokenRepository,
    passwordHasher,
    tokenProvider,
    otpService,
    eventPublisher,
    logger,
  );

  const controller = new AuthController(authService);
  const authRoutes = createAuthRoutes(
    authService,
    tokenProvider,
    tokenRepository,
    sessionRepository,
  );
  const authMiddleware = createAuthMiddleware(tokenProvider, tokenRepository, sessionRepository);

  return {
    authService,
    controller,
    authRoutes,
    authMiddleware,
    userRepository,
    sessionRepository,
    tokenRepository,
    passwordHasher,
    tokenProvider,
    otpService,
    eventPublisher,
  };
}
