import type { Logger } from '@config/logger';
import type { User } from '@modules/auth/domain/entities/User';
import type { AuthEventPublisher } from '@modules/auth/domain/events/AuthEventPublisher';
import type { AuthEvent } from '@modules/auth/domain/events/AuthEvents';
import type {
  Session,
  SessionRepository,
} from '@modules/auth/domain/repositories/SessionRepository';
import type {
  TokenRecord,
  TokenRepository,
} from '@modules/auth/domain/repositories/TokenRepository';
import type { UserRepository } from '@modules/auth/domain/repositories/UserRepository';
import type { OtpService } from '@modules/auth/domain/services/OtpService';

export const testLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    status: 'ACTIVE',
    version: 0,
    isEmailVerified: true,
    isActive: true,
    roles: ['user'],
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'session-1',
    userId: 'user-1',
    tokenId: 'access-jti-1',
    refreshTokenId: 'refresh-jti-1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    ipAddress: '127.0.0.1',
    isActive: true,
    createdAt: now,
    expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    lastActivityAt: now,
    ...overrides,
  };
}

export class FakeUserRepository implements UserRepository {
  readonly store = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email === email.toLowerCase()) return { ...user };
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.store.get(id);
    return user ? { ...user } : null;
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, { ...user });
  }

  async update(id: string, updates: Partial<User>): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, { ...existing, ...updates });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }
}

export class FakeSessionRepository implements SessionRepository {
  readonly store = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.store.set(session.id, { ...session });
  }

  async findById(id: string): Promise<Session | null> {
    const session = this.store.get(id);
    return session ? { ...session } : null;
  }

  async findByTokenId(tokenId: string): Promise<Session | null> {
    for (const session of this.store.values()) {
      if (session.tokenId === tokenId) return { ...session };
    }
    return null;
  }

  async findByRefreshTokenId(refreshTokenId: string): Promise<Session | null> {
    for (const session of this.store.values()) {
      if (session.refreshTokenId === refreshTokenId) return { ...session };
    }
    return null;
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    return [...this.store.values()]
      .filter((s) => s.userId === userId && s.isActive)
      .map((s) => ({ ...s }));
  }

  async findActiveByUserIdPaginated(
    userId: string,
    options: { limit: number; cursor?: string | null },
  ): Promise<{ sessions: Session[]; nextCursor: string | null }> {
    const all = [...this.store.values()]
      .filter((s) => s.userId === userId && s.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    let start = 0;
    if (options.cursor) {
      const index = all.findIndex((s) => s.id === options.cursor);
      start = index >= 0 ? index + 1 : 0;
    }
    const page = all.slice(start, start + options.limit);
    const hasMore = start + options.limit < all.length;
    return {
      sessions: page,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
    };
  }

  async revokeById(id: string): Promise<void> {
    const session = this.store.get(id);
    if (session) this.store.set(id, { ...session, isActive: false });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    for (const [id, session] of this.store) {
      if (session.userId === userId && session.isActive) {
        this.store.set(id, { ...session, isActive: false });
      }
    }
  }

  async revokeAllExcept(userId: string, exceptSessionId: string): Promise<number> {
    let count = 0;
    for (const [id, session] of this.store) {
      if (session.userId === userId && session.isActive && id !== exceptSessionId) {
        this.store.set(id, { ...session, isActive: false });
        count += 1;
      }
    }
    return count;
  }

  async revokeExpired(): Promise<void> {
    const now = new Date();
    for (const [id, session] of this.store) {
      if (session.expiresAt < now && session.isActive) {
        this.store.set(id, { ...session, isActive: false });
      }
    }
  }

  async isTokenReused(tokenId: string): Promise<boolean> {
    const session = await this.findByTokenId(tokenId);
    return session ? !session.isActive : false;
  }

  async markTokenUsed(tokenId: string): Promise<void> {
    const session = await this.findByTokenId(tokenId);
    if (session) await this.revokeById(session.id);
  }
}

export class FakeTokenRepository implements TokenRepository {
  readonly store = new Map<string, TokenRecord>();

  async saveToken(record: TokenRecord): Promise<void> {
    this.store.set(record.id, { ...record });
  }

  async findByToken(token: string): Promise<TokenRecord | null> {
    for (const record of this.store.values()) {
      if (record.token === token) return { ...record };
    }
    return null;
  }

  async revokeToken(tokenId: string): Promise<void> {
    const record = this.store.get(tokenId);
    if (record) this.store.set(tokenId, { ...record, isRevoked: true });
  }

  async revokeAllUserTokens(userId: string, exceptTokenId?: string): Promise<void> {
    for (const [id, record] of this.store) {
      if (record.userId === userId && id !== exceptTokenId) {
        this.store.set(id, { ...record, isRevoked: true });
      }
    }
  }

  async isTokenRevoked(tokenId: string): Promise<boolean> {
    return this.store.get(tokenId)?.isRevoked ?? false;
  }

  async markTokenUsed(tokenId: string): Promise<void> {
    const record = this.store.get(tokenId);
    if (record) this.store.set(tokenId, { ...record, isUsed: true });
  }

  async deleteExpiredTokens(): Promise<void> {
    const now = new Date();
    for (const [id, record] of this.store) {
      if (record.expiresAt < now) this.store.delete(id);
    }
  }
}

export class FakeOtpService implements OtpService {
  readonly codes = new Map<string, string>();

  async generateOtp(identifier: string): Promise<{ otp: string; expiresAt: Date }> {
    this.codes.set(identifier, '123456');
    return { otp: '123456', expiresAt: new Date(Date.now() + 300000) };
  }

  async verifyOtp(identifier: string, otp: string): Promise<boolean> {
    return this.codes.get(identifier) === otp;
  }

  async invalidateOtp(identifier: string): Promise<void> {
    this.codes.delete(identifier);
  }
}

export class FakeEventPublisher implements AuthEventPublisher {
  readonly events: AuthEvent[] = [];

  async publish(event: AuthEvent): Promise<void> {
    this.events.push(event);
  }
}
