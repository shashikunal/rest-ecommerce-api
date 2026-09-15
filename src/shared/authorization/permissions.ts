export type Role = 'CUSTOMER' | 'STAFF' | 'SUPPORT' | 'ADMIN' | 'SYSTEM';

export type Permission =
  | 'products:read'
  | 'products:create'
  | 'products:update'
  | 'products:publish'
  | 'products:archive'
  | 'products:manage-media'
  | 'orders:read'
  | 'orders:update'
  | 'inventory:adjust'
  | 'users:read'
  | 'users:suspend'
  | 'refunds:initiate'
  | 'refunds:approve'
  | 'reviews:moderate'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  CUSTOMER: ['products:read', 'orders:read'],
  STAFF: ['products:read', 'orders:read', 'orders:update', 'inventory:adjust'],
  SUPPORT: ['products:read', 'orders:read', 'users:read', 'refunds:initiate'],
  ADMIN: [
    'products:read',
    'products:create',
    'products:update',
    'products:publish',
    'products:archive',
    'products:manage-media',
    'orders:read',
    'orders:update',
    'inventory:adjust',
    'users:read',
    'users:suspend',
    'refunds:initiate',
    'refunds:approve',
    'reviews:moderate',
    'audit:read',
  ],
  SYSTEM: [
    'products:read',
    'orders:read',
    'orders:update',
    'inventory:adjust',
    'users:read',
    'audit:read',
  ],
};

const LEGACY_ROLE_ALIASES: Record<string, Role> = {
  user: 'CUSTOMER',
  customer: 'CUSTOMER',
  staff: 'STAFF',
  support: 'SUPPORT',
  admin: 'ADMIN',
  system: 'SYSTEM',
};

export function normalizeRole(role: string): Role | null {
  const direct = (Object.keys(ROLE_PERMISSIONS) as Role[]).find((r) => r === role);
  if (direct) return direct;
  return LEGACY_ROLE_ALIASES[role.toLowerCase()] ?? null;
}

export function permissionsFor(roles: string[]): Set<Permission> {
  const granted = new Set<Permission>();
  for (const role of roles) {
    const normalized = normalizeRole(role);
    if (!normalized) continue;
    for (const permission of ROLE_PERMISSIONS[normalized]) granted.add(permission);
  }
  return granted;
}

export function hasPermission(roles: string[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export function hasAnyRole(roles: string[], required: string[]): boolean {
  const normalizedHeld = new Set(
    roles.map((r) => normalizeRole(r)).filter((r): r is Role => r !== null),
  );
  return required.some((r) => {
    const normalized = normalizeRole(r);
    return normalized !== null && normalizedHeld.has(normalized);
  });
}
