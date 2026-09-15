export interface RefreshTokenPayload {
  readonly sub: string;
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
}

export interface RotatedRefreshToken {
  readonly oldToken: RefreshToken;
  readonly newToken: RefreshToken;
}

export class RefreshToken {
  public readonly token: string;
  public readonly payload: RefreshTokenPayload;
  public readonly expiresAt: Date;
  public readonly revoked: boolean;

  constructor(token: string, payload: RefreshTokenPayload, revoked = false) {
    this.token = token;
    this.payload = payload;
    this.expiresAt = new Date(payload.exp * 1000);
    this.revoked = revoked;
  }

  get isExpired(): boolean {
    return Date.now() >= this.expiresAt.getTime();
  }

  get userId(): string {
    return this.payload.sub;
  }

  get isRevoked(): boolean {
    return this.revoked;
  }
}
