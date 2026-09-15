export { User } from './entities/User';
export type { CreateUserPayload, UpdateUserPayload } from './entities/User';
export { Email } from './value-objects/Email';
export { Password } from './value-objects/Password';
export { AccessToken } from './value-objects/AccessToken';
export { RefreshToken } from './value-objects/RefreshToken';
export type { RotatedRefreshToken } from './value-objects/RefreshToken';
export type { Session } from './repositories/SessionRepository';
export type { TokenRecord } from './repositories/TokenRepository';
export { UserRepository } from './repositories/UserRepository';
export { SessionRepository } from './repositories/SessionRepository';
export { TokenRepository } from './repositories/TokenRepository';
export { PasswordHasher } from './services/PasswordHasher';
export { TokenProvider } from './services/TokenProvider';
export { OtpService } from './services/OtpService';
export { AuthEventPublisher } from './events/AuthEventPublisher';
export type { AuthEvent, AuthEventType } from './events/AuthEvents';
export {
  TokenExpiredError,
  TokenInvalidError,
  TokenReusedError,
  SessionRevokedError,
  EmailAlreadyVerifiedError,
  EmailNotVerifiedError,
  OtpExpiredError,
  OtpMaxAttemptsError,
  PasswordTooWeakError,
  PasswordMismatchError,
  RefreshTokenRevokedError,
  AccountLockedError,
  MaxSessionsReachedError,
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidCredentialsError,
  TokenRevokedError,
} from './errors/AuthErrors';
