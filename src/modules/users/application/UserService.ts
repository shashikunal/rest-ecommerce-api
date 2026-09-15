import { createHash } from 'crypto';

import type { Logger } from '@config/logger';
import type { User, UserPreferences } from '@modules/auth/domain/entities/User';
import { UserNotFoundError } from '@modules/auth/domain/errors/AuthErrors';
import type { AuthEventPublisher } from '@modules/auth/domain/events/AuthEventPublisher';
import type { SessionRepository } from '@modules/auth/domain/repositories/SessionRepository';
import type { TokenRepository } from '@modules/auth/domain/repositories/TokenRepository';
import type { UserRepository } from '@modules/auth/domain/repositories/UserRepository';
import type { OtpService } from '@modules/auth/domain/services/OtpService';

import {
  assertAccountUsable,
  toPublicProfile,
  type PublicProfile,
} from '../domain/entities/UserProfile';
import { ConcurrentUpdateError, InvalidProfileError } from '../domain/errors/UserErrors';
import { normalizePreferences } from '../domain/value-objects/Preferences';
import { canTransitionStatus } from '../domain/value-objects/UserStatus';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  version?: number;
}

export interface PhoneRequestResult {
  expiresAt: Date;
}

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly otpService: OtpService,
    private readonly eventPublisher: AuthEventPublisher,
    private readonly logger: Logger,
  ) {}

  async getMe(userId: string, correlationId?: string): Promise<PublicProfile> {
    const user = await this.requireUsableUser(userId, correlationId);
    return toPublicProfile(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    correlationId?: string,
  ): Promise<PublicProfile> {
    const user = await this.requireUsableUser(userId, correlationId);
    this.assertVersionMatch(user, input.version, correlationId);

    const firstName = input.firstName?.trim() || undefined;
    const lastName = input.lastName?.trim() || undefined;
    const explicitName = input.name?.trim() || undefined;
    const displayName =
      explicitName ?? ([firstName, lastName].filter(Boolean).join(' ') || undefined);

    const nextVersion = (user.version ?? 0) + 1;
    await this.userRepository.update(userId, {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(displayName !== undefined ? { name: displayName } : {}),
      version: nextVersion,
    });

    this.logger.info('User profile updated', { userId, correlationId });
    await this.eventPublisher.publish({
      type: 'USER_PROFILE_UPDATED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: correlationId ?? '',
    });

    const updated = await this.requireUsableUser(userId, correlationId);
    return toPublicProfile(updated);
  }

  async updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
    expectedVersion?: number,
    correlationId?: string,
  ): Promise<PublicProfile> {
    const user = await this.requireUsableUser(userId, correlationId);
    this.assertVersionMatch(user, expectedVersion, correlationId);

    let preferences: UserPreferences;
    try {
      preferences = normalizePreferences(user.preferences, patch);
    } catch (error) {
      throw new InvalidProfileError(
        (error as Error).message,
        { field: 'preferences' },
        correlationId,
      );
    }

    const nextVersion = (user.version ?? 0) + 1;
    await this.userRepository.update(userId, { preferences, version: nextVersion });

    this.logger.info('User preferences updated', { userId, correlationId });
    await this.eventPublisher.publish({
      type: 'USER_PREFERENCES_UPDATED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: correlationId ?? '',
    });

    const updated = await this.requireUsableUser(userId, correlationId);
    return toPublicProfile(updated);
  }

  async requestPhoneChange(
    userId: string,
    phone: string,
    correlationId?: string,
  ): Promise<PhoneRequestResult> {
    const user = await this.requireUsableUser(userId, correlationId);
    const normalizedPhone = phone.trim();
    if (!/^\+?[1-9]\d{6,14}$/.test(normalizedPhone)) {
      throw new InvalidProfileError('Invalid phone number', { field: 'phone' }, correlationId);
    }
    const identifier = this.phoneOtpIdentifier(userId, normalizedPhone);
    const { expiresAt } = await this.otpService.generateOtp(identifier);

    this.logger.info('Phone change OTP requested', { userId, correlationId });
    await this.eventPublisher.publish({
      type: 'USER_PHONE_CHANGE_REQUESTED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: correlationId ?? '',
      metadata: { phone: normalizedPhone, otpExpiresAt: expiresAt },
    });
    return { expiresAt };
  }

  async verifyPhoneChange(
    userId: string,
    phone: string,
    otp: string,
    correlationId?: string,
  ): Promise<PublicProfile> {
    const user = await this.requireUsableUser(userId, correlationId);
    const normalizedPhone = phone.trim();
    const identifier = this.phoneOtpIdentifier(userId, normalizedPhone);
    const valid = await this.otpService.verifyOtp(identifier, otp);
    if (!valid) {
      throw new InvalidProfileError('Invalid or expired OTP', { field: 'otp' }, correlationId);
    }
    await this.otpService.invalidateOtp(identifier);

    const nextVersion = (user.version ?? 0) + 1;
    await this.userRepository.update(userId, {
      phone: normalizedPhone,
      phoneVerified: true,
      version: nextVersion,
    });

    this.logger.info('Phone number changed', { userId, correlationId });
    await this.eventPublisher.publish({
      type: 'USER_PHONE_CHANGED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: correlationId ?? '',
    });

    const updated = await this.requireUsableUser(userId, correlationId);
    return toPublicProfile(updated);
  }

  async deactivate(
    userId: string,
    reason?: string,
    correlationId?: string,
  ): Promise<PublicProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UserNotFoundError('User not found', correlationId);
    const status = user.status ?? 'ACTIVE';
    if (status === 'DEACTIVATED') {
      return toPublicProfile(user);
    }
    if (!canTransitionStatus(status, 'DEACTIVATED')) {
      throw new InvalidProfileError(
        `Account cannot be deactivated from status ${status}`,
        { status },
        correlationId,
      );
    }

    const nextVersion = (user.version ?? 0) + 1;
    await this.userRepository.update(userId, {
      status: 'DEACTIVATED',
      isActive: false,
      deletedAt: new Date(),
      version: nextVersion,
    });
    await this.sessionRepository.revokeAllByUserId(userId);
    await this.tokenRepository.revokeAllUserTokens(userId);

    this.logger.info('User account deactivated', { userId, reason, correlationId });
    await this.eventPublisher.publish({
      type: 'USER_DEACTIVATED',
      userId,
      email: user.email,
      timestamp: new Date(),
      correlationId: correlationId ?? '',
      metadata: reason ? { reason } : undefined,
    });

    const updated = await this.userRepository.findById(userId);
    if (!updated) throw new UserNotFoundError('User not found', correlationId);
    return toPublicProfile(updated);
  }

  private async requireUsableUser(userId: string, correlationId?: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UserNotFoundError('User not found', correlationId);
    assertAccountUsable(user, correlationId);
    return user;
  }

  private assertVersionMatch(
    user: User,
    expectedVersion: number | undefined,
    correlationId?: string,
  ): void {
    if (expectedVersion !== undefined && (user.version ?? 0) !== expectedVersion) {
      throw new ConcurrentUpdateError(
        'Profile was modified by another request. Reload and retry.',
        correlationId,
      );
    }
  }

  private phoneOtpIdentifier(userId: string, phone: string): string {
    const phoneHash = createHash('sha256').update(phone).digest('hex');
    return `phone:${userId}:${phoneHash}`;
  }
}
