import { AuthService } from '@modules/auth/application/auth.service';
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidCredentialsError,
  TokenReusedError,
  EmailAlreadyVerifiedError,
  MaxSessionsReachedError,
  PasswordMismatchError,
} from '@modules/auth/domain/errors/AuthErrors';
import { Email } from '@modules/auth/domain/value-objects/Email';
import { Password } from '@modules/auth/domain/value-objects/Password';
import { Argon2PasswordHasher } from '@modules/auth/infrastructure/adapters/Argon2PasswordHasher';
import { InMemoryEventPublisher } from '@modules/auth/infrastructure/adapters/InMemoryEventPublisher';
import { JwtTokenProvider } from '@modules/auth/infrastructure/adapters/JwtTokenProvider';
import { RedisOtpService } from '@modules/auth/infrastructure/adapters/RedisOtpService';
import { MongoSessionRepository } from '@modules/auth/infrastructure/database/session.repository';
import { MongoTokenRepository } from '@modules/auth/infrastructure/database/token.repository';
import { MongoUserRepository } from '@modules/auth/infrastructure/database/user.repository';
import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockEnvConfig = {
  JWT_ACCESS_SECRET: 'test-secret-key-for-access-at-least-32-chars!',
  JWT_REFRESH_SECRET: 'test-secret-key-for-refresh-at-least-32-chars!',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '7d',
  NODE_ENV: 'test',
  PORT: 3000,
  API_BASE_URL: 'http://localhost:3000',
  MONGODB_URI: 'mongodb://localhost:27017/test',
  MONGODB_TEST_URI: 'mongodb://localhost:27017/test',
  REDIS_URL: 'redis://localhost:6379',
  KAFKA_BROKERS: 'localhost:9092',
  KAFKA_CLIENT_ID: 'test',
  KAFKA_GROUP_ID: 'test',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  SMTP_FROM: 'test@example.com',
  CORS_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'debug',
  SWAGGER_ENABLED: true,
  FEATURE_SWAGGER_UI: true,
  FEATURE_DEBUG_ENDPOINTS: false,
  IDEMPOTENCY_TTL: 86400,
  RATE_LIMITER_REDIS_TTL: 60,
  MAX_SESSIONS_PER_USER: 10,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION_MS: 900000,
  OTP_TTL_SECONDS: 300,
  OTP_MAX_ATTEMPTS: 5,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
};

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  name: 'Test User',
  isEmailVerified: false,
  isActive: true,
  roles: ['user'],
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: Record<string, any>;
  let mockSessionRepository: Record<string, any>;
  let mockTokenRepository: Record<string, any>;
  let mockPasswordHasher: Record<string, any>;
  let mockTokenProvider: Record<string, any>;
  let mockOtpService: Record<string, any>;
  let mockEventPublisher: Record<string, any>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    mockSessionRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTokenId: vi.fn(),
      findByRefreshTokenId: vi.fn(),
      findActiveByUserId: vi.fn(),
      findActiveByUserIdPaginated: vi.fn(),
      revokeById: vi.fn(),
      revokeAllByUserId: vi.fn(),
      revokeAllExcept: vi.fn(),
      revokeExpired: vi.fn(),
      isTokenReused: vi.fn(),
      markTokenUsed: vi.fn(),
    };
    mockTokenRepository = {
      saveToken: vi.fn(),
      findByToken: vi.fn(),
      revokeToken: vi.fn(),
      revokeAllUserTokens: vi.fn(),
      isTokenRevoked: vi.fn(),
      markTokenUsed: vi.fn(),
      deleteExpiredTokens: vi.fn(),
    };
    mockPasswordHasher = {
      hash: vi.fn(),
      verify: vi.fn(),
    };
    mockTokenProvider = {
      generateAccessToken: vi.fn(),
      generateRefreshToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    };
    mockOtpService = {
      generateOtp: vi.fn(),
      verifyOtp: vi.fn(),
      invalidateOtp: vi.fn(),
    };
    mockEventPublisher = {
      publish: vi.fn(),
    };

    authService = new AuthService(
      mockUserRepository as any,
      mockSessionRepository as any,
      mockTokenRepository as any,
      mockPasswordHasher as any,
      mockTokenProvider as any,
      mockOtpService as any,
      mockEventPublisher as any,
      mockLogger,
    );
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const email = 'newuser@example.com';
      const password = 'StrongPass1!';
      const passwordHash = '$argon2id$v=19$m=65536,t=3,p=1$hash';

      mockUserRepository.existsByEmail.mockResolvedValue(false);
      mockPasswordHasher.hash.mockResolvedValue(passwordHash);
      mockTokenProvider.generateAccessToken.mockResolvedValue('access-token');
      mockTokenProvider.generateRefreshToken.mockResolvedValue('refresh-token');
      const accessPayload = { jti: 'access-jti', exp: Math.floor(Date.now() / 1000) + 900 };
      const refreshPayload = { jti: 'refresh-jti', exp: Math.floor(Date.now() / 1000) + 604800 };
      mockTokenProvider.verifyAccessToken.mockResolvedValue(accessPayload);
      mockTokenProvider.verifyRefreshToken.mockResolvedValue(refreshPayload);
      mockTokenRepository.saveToken.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await authService.register({
        email,
        password,
        name: 'New User',
      });

      expect(result.user.email).toBe(email);
      expect(result.user.isEmailVerified).toBe(false);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw UserAlreadyExistsError if email exists', async () => {
      mockUserRepository.existsByEmail.mockResolvedValue(true);

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'StrongPass1!',
          name: 'Existing User',
        }),
      ).rejects.toThrow(UserAlreadyExistsError);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const user = makeUser({
        passwordHash: await Password.fromRaw('StrongPass1!').hash(),
      });
      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockTokenProvider.generateAccessToken.mockResolvedValue('access-token');
      mockTokenProvider.generateRefreshToken.mockResolvedValue('refresh-token');
      const accessPayload = { jti: 'access-jti', exp: Math.floor(Date.now() / 1000) + 900 };
      const refreshPayload = { jti: 'refresh-jti', exp: Math.floor(Date.now() / 1000) + 604800 };
      mockTokenProvider.verifyAccessToken.mockResolvedValue(accessPayload);
      mockTokenProvider.verifyRefreshToken.mockResolvedValue(refreshPayload);
      mockTokenRepository.saveToken.mockResolvedValue(undefined);
      mockSessionRepository.findActiveByUserId.mockResolvedValue([]);
      mockSessionRepository.create.mockResolvedValue(undefined);
      mockUserRepository.update.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await authService.login(
        'test@example.com',
        'StrongPass1!',
        '127.0.0.1',
        'Mozilla',
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      const user = makeUser({ passwordHash: '$argon2id$hash' });
      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockPasswordHasher.verify.mockResolvedValue(false);

      await expect(
        authService.login('test@example.com', 'WrongPass1!', '127.0.0.1', 'Mozilla'),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login('unknown@example.com', 'StrongPass1!', '127.0.0.1', 'Mozilla'),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw AccountLockedError for inactive account', async () => {
      const user = makeUser({ isActive: false });
      mockUserRepository.findByEmail.mockResolvedValue(user);

      await expect(
        authService.login('test@example.com', 'StrongPass1!', '127.0.0.1', 'Mozilla'),
      ).rejects.toThrow(AppError);
      const error = await authService
        .login('test@example.com', 'StrongPass1!', '127.0.0.1', 'Mozilla')
        .catch((e) => e);
      expect(error.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const user = makeUser();
      const refreshTokenStr = 'refresh-token';
      const oldTokenDoc = {
        id: 'old-jti',
        userId: 'user-1',
        token: refreshTokenStr,
        isRevoked: false,
        isUsed: false,
      };
      const accessPayload = { jti: 'new-access-jti', exp: Math.floor(Date.now() / 1000) + 900 };
      const refreshPayload = {
        jti: 'new-refresh-jti',
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      mockTokenProvider.verifyRefreshToken.mockResolvedValue(refreshPayload);
      mockTokenRepository.findByToken.mockResolvedValue(oldTokenDoc);
      mockUserRepository.findById.mockResolvedValue(user);
      mockTokenProvider.generateAccessToken.mockResolvedValue('new-access');
      mockTokenProvider.generateRefreshToken.mockResolvedValue('new-refresh');
      mockTokenProvider.verifyAccessToken.mockResolvedValue(accessPayload);
      mockTokenRepository.revokeToken.mockResolvedValue(undefined);
      mockTokenRepository.markTokenUsed.mockResolvedValue(undefined);
      mockTokenRepository.saveToken.mockResolvedValue(undefined);
      mockSessionRepository.findByRefreshTokenId.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        tokenId: 'old-access-jti',
        isActive: true,
        userAgent: 'ua',
        ipAddress: 'ip',
      });
      mockSessionRepository.revokeById.mockResolvedValue(undefined);
      mockSessionRepository.create.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await authService.refreshTokens(refreshTokenStr);
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
    });

    it('should throw TokenReusedError for reused refresh token', async () => {
      const oldTokenDoc = { id: 'old-jti', isRevoked: true, isUsed: false };
      mockTokenProvider.verifyRefreshToken.mockResolvedValue({
        sub: 'user-1',
        jti: 'old-jti',
        exp: Math.floor(Date.now() / 1000) + 604800,
      });
      mockTokenRepository.findByToken.mockResolvedValue(oldTokenDoc);

      await expect(authService.refreshTokens('reused-token')).rejects.toThrow(TokenReusedError);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockTokenRepository.findByToken.mockResolvedValue(null);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await authService.logout('user-1', 'access-token');
      expect(mockSessionRepository.revokeAllByUserId).not.toHaveBeenCalled();
    });

    it('should revoke only the current session on logout', async () => {
      mockTokenRepository.findByToken.mockResolvedValue({
        id: 'access-jti-1',
        userId: 'user-1',
        isRevoked: false,
        isUsed: false,
      });
      mockTokenRepository.revokeToken.mockResolvedValue(undefined);
      mockTokenRepository.markTokenUsed.mockResolvedValue(undefined);
      mockSessionRepository.findByTokenId.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        tokenId: 'access-jti-1',
        isActive: true,
      });
      mockSessionRepository.revokeById.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await authService.logout('user-1', 'access-token');
      expect(mockSessionRepository.revokeById).toHaveBeenCalledWith('sess-1');
      expect(mockSessionRepository.revokeAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all sessions for user', async () => {
      await authService.logoutAll('user-1');
      expect(mockTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const user = makeUser({
        passwordHash: await Password.fromRaw('OldPass1!').hash(),
      });
      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(undefined);
      mockTokenRepository.revokeAllUserTokens.mockResolvedValue(undefined);
      mockSessionRepository.revokeAllByUserId.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await authService.changePassword('user-1', 'OldPass1!', 'NewPass1!');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
      });
    });

    it('should throw PasswordMismatchError for wrong current password', async () => {
      const user = makeUser({ passwordHash: '$argon2id$hash' });
      mockUserRepository.findById.mockResolvedValue(user);
      mockPasswordHasher.verify.mockResolvedValue(false);

      await expect(
        authService.changePassword('user-1', 'WrongPass1!', 'NewPass1!'),
      ).rejects.toThrow(PasswordMismatchError);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const user = makeUser();
      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockOtpService.verifyOtp.mockResolvedValue(true);
      mockPasswordHasher.hash.mockResolvedValue('$argon2id$newhash');
      mockUserRepository.update.mockResolvedValue(undefined);
      mockTokenRepository.revokeAllUserTokens.mockResolvedValue(undefined);
      mockSessionRepository.revokeAllByUserId.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await authService.resetPassword('test@example.com', '1234', 'NewPass1!');
      expect(mockUserRepository.update).toHaveBeenCalledWith(user.id, {
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
      });
    });
  });
});
