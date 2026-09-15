export interface TokenProvider {
  generateAccessToken(userId: string, email: string, roles: string[]): Promise<string>;
  generateRefreshToken(userId: string): Promise<string>;
  verifyAccessToken(token: string): Promise<Record<string, unknown>>;
  verifyRefreshToken(token: string): Promise<Record<string, unknown>>;
}
