const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

export class Email {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(email: string): Email {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length > MAX_EMAIL_LENGTH) {
      throw new Error('Email exceeds maximum length');
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      throw new Error('Invalid email format');
    }
    return new Email(trimmed);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
