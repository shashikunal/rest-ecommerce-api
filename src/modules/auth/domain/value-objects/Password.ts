const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_+=])[A-Za-z\d@$!%*?&#^()\-_+=]{8,}$/;

export class Password {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Password {
    if (raw.length < MIN_PASSWORD_LENGTH || raw.length > MAX_PASSWORD_LENGTH) {
      throw new Error('Password must be between 8 and 128 characters');
    }
    if (!PASSWORD_PATTERN.test(raw)) {
      throw new Error('Password must contain uppercase, lowercase, digit, and special character');
    }
    return new Password(raw);
  }

  static fromRaw(raw: string): Password {
    if (raw.length < MIN_PASSWORD_LENGTH || raw.length > MAX_PASSWORD_LENGTH) {
      throw new Error('Password must be between 8 and 128 characters');
    }
    return new Password(raw);
  }

  async hash(): Promise<string> {
    const argon2 = await import('argon2');
    return argon2.hash(this.value, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  async verify(hash: string): Promise<boolean> {
    const argon2 = await import('argon2');
    try {
      return await argon2.verify(hash, this.value);
    } catch {
      return false;
    }
  }
}
