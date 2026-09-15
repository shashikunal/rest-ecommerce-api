import type { EnvConfig } from '@config/env';
import type { Logger } from '@config/logger';
import { sign, verify, type JwtPayload } from 'jsonwebtoken';

import type { TokenProvider } from '../../domain/services/TokenProvider';

export class JwtTokenProvider implements TokenProvider {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    config: EnvConfig,
    private readonly logger: Logger,
  ) {
    this.accessSecret = config.JWT_ACCESS_SECRET;
    this.refreshSecret = config.JWT_REFRESH_SECRET;
    this.accessTtl = config.ACCESS_TOKEN_TTL;
    this.refreshTtl = config.REFRESH_TOKEN_TTL;
  }

  async generateAccessToken(userId: string, email: string, roles: string[]): Promise<string> {
    const payload = { sub: userId, email, roles };
    const token = sign(payload, this.accessSecret as string, {
      expiresIn: this.accessTtl as any,
      issuer: 'rest-mock-apis',
      audience: userId,
    });
    this.logger.debug('Access token generated', { userId });
    return token;
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const payload = { sub: userId };
    const token = sign(payload, this.refreshSecret as string, {
      expiresIn: this.refreshTtl as any,
      issuer: 'rest-mock-apis',
      audience: userId,
    });
    this.logger.debug('Refresh token generated', { userId });
    return token;
  }

  async verifyAccessToken(token: string): Promise<Record<string, unknown>> {
    try {
      const payload = verify(token, this.accessSecret as string, {
        issuer: 'rest-mock-apis',
      }) as JwtPayload;
      return { sub: payload.sub, email: payload.email, roles: payload.roles, jti: payload.jti };
    } catch (error) {
      this.logger.warn('Access token verification failed', { error: (error as Error).message });
      throw error;
    }
  }

  async verifyRefreshToken(token: string): Promise<Record<string, unknown>> {
    try {
      const payload = verify(token, this.refreshSecret as string, {
        issuer: 'rest-mock-apis',
      }) as JwtPayload;
      return { sub: payload.sub, jti: payload.jti };
    } catch (error) {
      this.logger.warn('Refresh token verification failed', { error: (error as Error).message });
      throw error;
    }
  }
}
