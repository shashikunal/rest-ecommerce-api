import { randomBytes } from 'crypto';

import type { Logger } from '@config/logger';
import { getRedisClient, isRedisConnected } from '@config/redis';
import type { OtpService } from '@modules/auth/domain/services/OtpService';
import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class RedisOtpService implements OtpService {
  private readonly otpTtlSeconds = 300;
  private readonly maxAttempts = 5;

  constructor(private readonly logger: Logger) {}

  async generateOtp(email: string): Promise<{ otp: string; expiresAt: Date }> {
    const client = getRedisClient();
    if (!client || !isRedisConnected()) {
      throw new AppError({
        code: ERROR_CODES.REDIS_ERROR,
        message: 'Redis not available for OTP generation',
      });
    }

    const otp = randomBytes(3).toString('hex').toUpperCase();
    const key = `auth:otp:${email.toLowerCase()}`;
    const hashedOtp = await this.hashOtp(otp);
    const now = Date.now();
    const expiresAt = new Date(now + this.otpTtlSeconds * 1000);

    await client.set(key, hashedOtp, { EX: this.otpTtlSeconds, NX: true });
    await client.set(`auth:otp:attempts:${email.toLowerCase()}`, '0', {
      EX: this.otpTtlSeconds,
      NX: true,
    });

    this.logger.info('OTP generated', { email, expiresAt });
    return { otp, expiresAt };
  }

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client || !isRedisConnected()) {
      throw new AppError({
        code: ERROR_CODES.REDIS_ERROR,
        message: 'Redis not available for OTP verification',
      });
    }

    const key = `auth:otp:${email.toLowerCase()}`;
    const attemptsKey = `auth:otp:attempts:${email.toLowerCase()}`;
    const storedHash = await client.get(key);
    const attempts = parseInt((await client.get(attemptsKey)) ?? '0', 10);

    if (attempts >= this.maxAttempts) {
      throw new AppError({
        code: ERROR_CODES.OTP_MAX_ATTEMPTS,
        message: 'Maximum OTP attempts exceeded',
      });
    }

    if (!storedHash) {
      throw new AppError({
        code: ERROR_CODES.OTP_EXPIRED,
        message: 'OTP has expired or not generated',
      });
    }

    const isValid = await this.compareOtp(otp, storedHash);
    await client.incr(attemptsKey);
    await client.expire(attemptsKey, this.otpTtlSeconds);

    if (!isValid) {
      throw new AppError({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid OTP' });
    }

    await client.del(key);
    await client.del(attemptsKey);
    return true;
  }

  async invalidateOtp(email: string): Promise<void> {
    const client = getRedisClient();
    if (!client || !isRedisConnected()) return;
    await client.del(`auth:otp:${email.toLowerCase()}`);
    await client.del(`auth:otp:attempts:${email.toLowerCase()}`);
  }

  private async hashOtp(otp: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  private async compareOtp(otp: string, hash: string): Promise<boolean> {
    return (await this.hashOtp(otp)) === hash;
  }
}
