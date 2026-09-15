import type { UserStatus } from '@modules/auth/domain/entities/User';

const ALLOWED_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  PENDING_VERIFICATION: ['ACTIVE'],
  ACTIVE: ['SUSPENDED', 'LOCKED', 'DEACTIVATED'],
  SUSPENDED: ['ACTIVE', 'DEACTIVATED'],
  LOCKED: ['ACTIVE', 'DEACTIVATED'],
  DEACTIVATED: [],
};

export function canTransitionStatus(from: UserStatus, to: UserStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function assertStatusTransition(from: UserStatus, to: UserStatus): void {
  if (!canTransitionStatus(from, to)) {
    throw new Error(`Invalid account status transition: ${from} -> ${to}`);
  }
}

export function normalizeStatus(status: string | undefined): UserStatus {
  if (
    status === 'PENDING_VERIFICATION' ||
    status === 'ACTIVE' ||
    status === 'SUSPENDED' ||
    status === 'LOCKED' ||
    status === 'DEACTIVATED'
  ) {
    return status;
  }
  return 'ACTIVE';
}
