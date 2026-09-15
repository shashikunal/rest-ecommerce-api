export interface AccessTokenPayload {
  readonly sub: string;
  readonly email: string;
  readonly roles: string[];
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
}

export class AccessToken {
  public readonly token: string;
  public readonly payload: AccessTokenPayload;
  public readonly expiresAt: Date;

  constructor(token: string, payload: AccessTokenPayload) {
    this.token = token;
    this.payload = payload;
    this.expiresAt = new Date(payload.exp * 1000);
  }

  get isExpired(): boolean {
    return Date.now() >= this.expiresAt.getTime();
  }

  get userId(): string {
    return this.payload.sub;
  }
}
