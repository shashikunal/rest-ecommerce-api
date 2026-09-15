export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenId: string;
  readonly refreshTokenId?: string;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  findByTokenId(tokenId: string): Promise<Session | null>;
  findByRefreshTokenId(refreshTokenId: string): Promise<Session | null>;
  findActiveByUserId(userId: string): Promise<Session[]>;
  findActiveByUserIdPaginated(
    userId: string,
    options: { limit: number; cursor?: string | null },
  ): Promise<{ sessions: Session[]; nextCursor: string | null }>;
  revokeById(id: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
  revokeAllExcept(userId: string, exceptSessionId: string): Promise<number>;
  revokeExpired(): Promise<void>;
  isTokenReused(tokenId: string): Promise<boolean>;
  markTokenUsed(tokenId: string): Promise<void>;
}
