export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'DEACTIVATED';

export interface UserPreferences {
  marketingEmails: boolean;
  orderNotifications: boolean;
  securityNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  language: string;
  currency: string;
}

export interface User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly phoneVerified?: boolean;
  readonly status?: UserStatus;
  readonly preferences?: UserPreferences;
  readonly version?: number;
  readonly deletedAt?: Date | null;
  readonly isEmailVerified: boolean;
  readonly isActive: boolean;
  readonly roles: string[];
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateUserPayload {
  email: string;
  passwordHash: string;
  name: string;
  roles?: string[];
}

export interface UpdateUserPayload {
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneVerified?: boolean;
  status?: UserStatus;
  preferences?: Partial<UserPreferences>;
  version?: number;
  deletedAt?: Date | null;
  passwordHash?: string;
  isEmailVerified?: boolean;
  isActive?: boolean;
  roles?: string[];
  lastLoginAt?: Date | null;
}
