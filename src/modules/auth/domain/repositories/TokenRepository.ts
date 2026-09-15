export interface TokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly tokenType: 'access' | 'refresh';
  readonly isRevoked: boolean;
  readonly isUsed: boolean;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface TokenRepository {
  saveToken(record: TokenRecord): Promise<void>;
  findByToken(token: string): Promise<TokenRecord | null>;
  revokeToken(tokenId: string): Promise<void>;
  revokeAllUserTokens(userId: string, exceptTokenId?: string): Promise<void>;
  isTokenRevoked(tokenId: string): Promise<boolean>;
  markTokenUsed(tokenId: string): Promise<void>;
  deleteExpiredTokens(): Promise<void>;
}
