import type { User, UserPreferences, UserStatus } from '@modules/auth/domain/entities/User';

import { UserDeactivatedError, UserSuspendedError } from '../errors/UserErrors';

export interface PublicProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneVerified: boolean;
  status: UserStatus;
  roles: string[];
  emailVerified: boolean;
  preferences: UserPreferences;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicProfile(user: User): PublicProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    phoneVerified: user.phoneVerified ?? false,
    status: user.status ?? 'ACTIVE',
    roles: [...user.roles],
    emailVerified: user.isEmailVerified,
    preferences: user.preferences ?? {
      marketingEmails: false,
      orderNotifications: true,
      securityNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      language: 'en',
      currency: 'USD',
    },
    version: user.version ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function assertAccountUsable(user: User, correlationId?: string): void {
  const status = user.status ?? 'ACTIVE';
  if (status === 'DEACTIVATED' || !user.isActive) {
    throw new UserDeactivatedError('Account is deactivated', correlationId);
  }
  if (status === 'SUSPENDED' || status === 'LOCKED') {
    throw new UserSuspendedError('Account is suspended', correlationId);
  }
}
