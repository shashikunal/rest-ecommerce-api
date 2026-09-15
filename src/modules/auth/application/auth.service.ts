import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';
import { v4 as uuidv4 } from 'uuid';

import type { User, CreateUserPayload } from '../domain/entities/User';
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidCredentialsError,
  TokenExpiredError,
  TokenInvalidError,
  TokenReusedError,
  EmailNotVerifiedError,
  EmailAlreadyVerifiedError,
  PasswordTooWeakError,
  PasswordMismatchError,
  AccountLockedError,
  MaxSessionsReachedError,
  OtpExpiredError,
} from '../domain/errors/AuthErrors';
import type { AuthEventPublisher } from '../domain/events/AuthEventPublisher';
import type { AuthEvent } from '../domain/events/AuthEvents';
import type { SessionRepository } from '../domain/repositories/SessionRepository';
import type { TokenRepository } from '../domain/repositories/TokenRepository';
import type { UserRepository } from '../domain/repositories/UserRepository';
import type { OtpService } from '../domain/services/OtpService';
import type { PasswordHasher } from '../domain/services/PasswordHasher';
import type { TokenProvider } from '../domain/services/TokenProvider';
import { AccessToken } from '../domain/value-objects/AccessToken';
import { Email } from '../domain/value-objects/Email';
import { Password } from '../domain/value-objects/Password';
import { RefreshToken, type RotatedRefreshToken } from '../domain/value-objects/RefreshToken';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private readonly MAX_SESSIONS = 10;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenProvider: TokenProvider,
    private readonly otpService: OtpService,
    private readonly eventPublisher: AuthEventPublisher,
    private readonly logger: any,
  ) {}

  async register(payload: RegisterUserInput): Promise<RegisterResult> {
    const email = Email.create(payload.email);
    if (await this.userRepository.existsByEmail(email.value)) {
      throw new UserAlreadyExistsError(`User with email ${email.value} already exists`);
    }

    const password = Password.fromRaw(payload.password);
    const passwordHash = await password.hash();
    const now = new Date();

    const user: User = {
      id: uuidv4(),
      email: email.value,
      passwordHash,
      name: payload.name.trim(),
      isEmailVerified: false,
      isActive: true,
      roles: payload.roles ?? ['user'],
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepository.save(user);

    const accessToken = await this.tokenProvider.generateAccessToken(
      user.id,
      user.email,
      user.roles,
    );
    const refreshToken = await this.tokenProvider.generateRefreshToken(user.id);

    const accessTokenPayload = (await this.tokenProvider.verifyAccessToken(accessToken)) as Record<
      string,
      unknown
    >;
    const accessJti = accessTokenPayload.jti as string;
    const refreshTokenPayload = (await this.tokenProvider.verifyRefreshToken(
      refreshToken,
    )) as Record<string, unknown>;
    const refreshJti = refreshTokenPayload.jti as string;

    await this.tokenRepository.saveToken({
      id: accessJti,
      userId: user.id,
      token: accessToken,
      tokenType: 'access',
      isRevoked: false,
      isUsed: false,
      expiresAt: new Date(Number(accessTokenPayload.exp!) * 1000),
      createdAt: now,
    });

    await this.tokenRepository.saveToken({
      id: refreshJti,
      userId: user.id,
      token: refreshToken,
      tokenType: 'refresh',
      isRevoked: false,
      isUsed: false,
      expiresAt: new Date(Number(refreshTokenPayload.exp!) * 1000),
      createdAt: now,
    });

    await this.eventPublisher.publish({
      type: 'USER_REGISTERED',
      userId: user.id,
      email: user.email,
      timestamp: now,
      correlationId: '',
    });

    return { user, accessToken, refreshToken, expiresIn: 900 };
  }

  async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResult> {
    const emailVo = Email.create(email);
    const user = await this.userRepository.findByEmail(emailVo.value);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new AccountLockedError('Account has been locked');
    }

    const pwd = Password.fromRaw(password);
    const isValid = await pwd.verify(user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const now = new Date();
    const accessToken = await this.tokenProvider.generateAccessToken(
      user.id,
      user.email,
      user.roles,
    );
    const refreshToken = await this.tokenProvider.generateRefreshToken(user.id);

    const accessPayload = (await this.tokenProvider.verifyAccessToken(accessToken)) as Record<
      string,
      unknown
    >;
    const accessJti = accessPayload.jti as string;
    const refreshPayload = (await this.tokenProvider.verifyRefreshToken(refreshToken)) as Record<
      string,
      unknown
    >;
    const refreshJti = refreshPayload.jti as string;

    const sessions = await this.sessionRepository.findActiveByUserId(user.id);
    if (sessions.length >= this.MAX_SESSIONS) {
      throw new MaxSessionsReachedError();
    }

    await this.tokenRepository.saveToken({
      id: accessJti,
      userId: user.id,
      token: accessToken,
      tokenType: 'access',
      isRevoked: false,
      isUsed: false,
      expiresAt: new Date(Number(accessPayload.exp!) * 1000),
      createdAt: now,
    });

    await this.tokenRepository.saveToken({
      id: refreshJti,
      userId: user.id,
      token: refreshToken,
      tokenType: 'refresh',
      isRevoked: false,
      isUsed: false,
      expiresAt: new Date(Number(refreshPayload.exp!) * 1000),
      createdAt: now,
    });

    const sessionId = uuidv4();
    await this.sessionRepository.create({
      id: sessionId,
      userId: user.id,
      tokenId: accessJti,
      refreshTokenId: refreshJti,
      userAgent,
      ipAddress,
      isActive: true,
      createdAt: now,
      expiresAt: new Date(Number(accessPayload.exp!) * 1000),
      lastActivityAt: now,
    });

    await this.userRepository.update(user.id, { lastLoginAt: now });

    await this.eventPublisher.publish({
      type: 'USER_LOGGED_IN',
      userId: user.id,
      email: user.email,
      timestamp: now,
      correlationId: '',
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  async refreshTokens(refreshTokenStr: string): Promise<RefreshResult> {
    const now = new Date();
    let payload: Record<string, unknown>;
    try {
      payload = (await this.tokenProvider.verifyRefreshToken(refreshTokenStr)) as Record<
        string,
        unknown
      >;
    } catch {
      throw new TokenInvalidError();
    }

    const tokenDoc = await this.tokenRepository.findByToken(refreshTokenStr);
    if (!tokenDoc || tokenDoc.isRevoked || tokenDoc.isUsed) {
      throw new TokenReusedError('Refresh token has already been used');
    }

    const userId = payload.sub as string;
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UserNotFoundError();
    }

    const newAccessToken = await this.tokenProvider.generateAccessToken(
      user.id,
      user.email,
      user.roles,
    );
    const newRefreshToken = await this.tokenProvider.generateRefreshToken(user.id);

    const newAccessPayload = (await this.tokenProvider.verifyAccessToken(newAccessToken)) as Record<
      string,
      unknown
    >;
    const newAccessJti = newAccessPayload.jti as string;
    const newRefreshPayload = (await this.tokenProvider.verifyRefreshToken(
      newRefreshToken,
    )) as Record<string, unknown>;
    const newRefreshJti = newRefreshPayload.jti as string;

    await this.tokenRepository.revokeToken(tokenDoc.id);
    await this.tokenRepository.markTokenUsed(tokenDoc.id);

    const previousSession = await this.sessionRepository.findByRefreshTokenId(tokenDoc.id);
    const rotateSession =
      previousSession && previousSession.userId === userId && previousSession.isActive
        ? previousSession
        : null;
    if (previousSession && previousSession.userId === userId && previousSession.isActive) {
      await this.sessionRepository.revokeById(previousSession.id);
      await this.tokenRepository.revokeToken(previousSession.tokenId).catch(() => undefined);
    }

    await this.tokenRepository.saveToken({
      id: newAccessJti,
      userId: user.id,
      token: newAccessToken,
      tokenType: 'access',
      isRevoked: false,
      isUsed: false,
      expiresAt: new Date(Number(newAccessPayload.exp!) * 1000),
      createdAt: now,
    });

    await this.tokenRepository.saveToken({
      id: newRefreshJti,
      userId: user.id,
      token: newRefreshToken,
      tokenType: 'refresh',
      isRevoked: false,
      isUsed: false,
      expiresAt: new Date(Number(newRefreshPayload.exp!) * 1000),
      createdAt: now,
    });

    if (rotateSession) {
      await this.sessionRepository.create({
        id: uuidv4(),
        userId,
        tokenId: newAccessJti,
        refreshTokenId: newRefreshJti,
        userAgent: rotateSession.userAgent,
        ipAddress: rotateSession.ipAddress,
        isActive: true,
        createdAt: now,
        expiresAt: new Date(Number(newAccessPayload.exp!) * 1000),
        lastActivityAt: now,
      });
    }

    await this.eventPublisher.publish({
      type: 'TOKEN_REFRESHED',
      userId,
      email: user.email,
      timestamp: now,
      correlationId: '',
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900 };
  }

  async logout(userId: string, accessToken: string): Promise<void> {
    const tokenDoc = await this.tokenRepository.findByToken(accessToken);
    if (tokenDoc && !tokenDoc.isRevoked) {
      await this.tokenRepository.revokeToken(tokenDoc.id);
      await this.tokenRepository.markTokenUsed(tokenDoc.id);
      const session = await this.sessionRepository.findByTokenId(tokenDoc.id);
      if (session && session.userId === userId && session.isActive) {
        await this.sessionRepository.revokeById(session.id);
      }
    }

    await this.eventPublisher.publish({
      type: 'USER_LOGGED_OUT',
      userId,
      email: '',
      timestamp: new Date(),
      correlationId: '',
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokenRepository.revokeAllUserTokens(userId);
    await this.sessionRepository.revokeAllByUserId(userId);

    await this.eventPublisher.publish({
      type: 'USER_LOGGED_OUT',
      userId,
      email: '',
      timestamp: new Date(),
      correlationId: '',
    });
  }

  async verifyEmail(userId: string, otp: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (user.isEmailVerified) {
      throw new EmailAlreadyVerifiedError();
    }

    const isValid = await this.otpService.verifyOtp(user.email, otp);
    if (!isValid) {
      throw new AppError({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid OTP' });
    }

    await this.userRepository.update(userId, { isEmailVerified: true });

    await this.eventPublisher.publish({
      type: 'EMAIL_VERIFIED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: '',
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return;
    }

    const otp = await this.otpService.generateOtp(user.email);
    await this.eventPublisher.publish({
      type: 'PASSWORD_RESET_REQUESTED',
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
      correlationId: '',
      metadata: { otpExpiresAt: otp.expiresAt },
    });
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UserNotFoundError();
    }

    const isValid = await this.otpService.verifyOtp(user.email, otp);
    if (!isValid) {
      throw new AppError({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid OTP' });
    }

    const password = Password.fromRaw(newPassword);
    const passwordHash = await password.hash();
    await this.userRepository.update(user.id, { passwordHash });

    await this.tokenRepository.revokeAllUserTokens(user.id);
    await this.sessionRepository.revokeAllByUserId(user.id);

    await this.eventPublisher.publish({
      type: 'PASSWORD_RESET_COMPLETED',
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
      correlationId: '',
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const currentPwd = Password.fromRaw(currentPassword);
    const isValid = await currentPwd.verify(user.passwordHash);
    if (!isValid) {
      throw new PasswordMismatchError();
    }

    const newPwd = Password.fromRaw(newPassword);
    const newHash = await newPwd.hash();
    await this.userRepository.update(userId, { passwordHash: newHash });

    await this.tokenRepository.revokeAllUserTokens(userId);
    await this.sessionRepository.revokeAllByUserId(userId);

    await this.eventPublisher.publish({
      type: 'PASSWORD_CHANGED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: '',
    });
  }
}

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  roles?: string[];
}
