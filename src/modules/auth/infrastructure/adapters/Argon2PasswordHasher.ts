import type { Logger } from '@config/logger';

import type { PasswordHasher } from '../../domain/services/PasswordHasher';

export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly logger: Logger) {}

  async hash(password: string): Promise<string> {
    this.logger.debug('Hashing password with Argon2id');
    const argon2 = await import('argon2');
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    this.logger.debug('Password hashed successfully');
    return hash;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      const argon2 = await import('argon2');
      const isValid = await argon2.verify(hash, password);
      this.logger.debug('Password verification result', { isValid });
      return isValid;
    } catch (error) {
      this.logger.warn('Password verification failed', { error: (error as Error).message });
      return false;
    }
  }
}
