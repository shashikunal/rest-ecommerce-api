export type AuthEventType =
  | 'USER_REGISTERED'
  | 'USER_LOGGED_IN'
  | 'USER_LOGGED_OUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_VERIFIED'
  | 'SESSION_REVOKED'
  | 'ALL_SESSIONS_REVOKED'
  | 'ACCOUNT_LOCKED'
  | 'TOKEN_REFRESHED'
  | 'USER_PROFILE_UPDATED'
  | 'USER_PREFERENCES_UPDATED'
  | 'USER_PHONE_CHANGE_REQUESTED'
  | 'USER_PHONE_CHANGED'
  | 'USER_DEACTIVATED';

export interface AuthEvent {
  readonly type: AuthEventType;
  readonly userId: string;
  readonly email: string;
  readonly timestamp: Date;
  readonly correlationId: string;
  readonly metadata?: Record<string, unknown>;
}
