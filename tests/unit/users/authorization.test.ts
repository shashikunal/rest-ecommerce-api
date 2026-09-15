import {
  assertOwnership,
  assertOwnershipOrNotFound,
  requirePermission,
} from '@shared/authorization/authorization';
import {
  hasAnyRole,
  hasPermission,
  normalizeRole,
  permissionsFor,
} from '@shared/authorization/permissions';
import { ERROR_CODES } from '@shared/errors/error-codes';
import { describe, it, expect } from 'vitest';

describe('Role normalization', () => {
  it('accepts canonical roles and legacy aliases', () => {
    expect(normalizeRole('ADMIN')).toBe('ADMIN');
    expect(normalizeRole('admin')).toBe('ADMIN');
    expect(normalizeRole('user')).toBe('CUSTOMER');
    expect(normalizeRole('customer')).toBe('CUSTOMER');
    expect(normalizeRole('nobody')).toBeNull();
  });
});

describe('Permissions', () => {
  it('grants admin full management permissions', () => {
    expect(hasPermission(['admin'], 'users:suspend')).toBe(true);
    expect(hasPermission(['admin'], 'refunds:approve')).toBe(true);
  });

  it('denies customers admin permissions', () => {
    expect(hasPermission(['user'], 'users:suspend')).toBe(false);
    expect(hasPermission(['user'], 'products:create')).toBe(false);
    expect(hasPermission(['user'], 'products:read')).toBe(true);
  });

  it('caps support role (read + limited refunds)', () => {
    const permissions = permissionsFor(['support']);
    expect(permissions.has('refunds:initiate')).toBe(true);
    expect(permissions.has('refunds:approve')).toBe(false);
    expect(permissions.has('users:suspend')).toBe(false);
  });

  it('matches any held role', () => {
    expect(hasAnyRole(['user'], ['admin', 'CUSTOMER'])).toBe(true);
    expect(hasAnyRole(['user'], ['ADMIN'])).toBe(false);
  });
});

describe('Resource ownership', () => {
  it('allows owner access', () => {
    expect(() => assertOwnership('user-1', 'user-1')).not.toThrow();
  });

  it('forbids cross-user access with 403', () => {
    try {
      assertOwnership('user-2', 'user-1');
      expect.unreachable();
    } catch (error: unknown) {
      expect((error as { code: string }).code).toBe(ERROR_CODES.FORBIDDEN);
    }
  });

  it('hides missing/foreign resources with 404 (anti-enumeration)', () => {
    try {
      assertOwnershipOrNotFound('user-2', 'user-1');
      expect.unreachable();
    } catch (error: unknown) {
      expect((error as { code: string }).code).toBe(ERROR_CODES.NOT_FOUND);
    }
    try {
      assertOwnershipOrNotFound(null, 'user-1');
      expect.unreachable();
    } catch (error: unknown) {
      expect((error as { code: string }).code).toBe(ERROR_CODES.NOT_FOUND);
    }
  });
});

describe('requirePermission middleware', () => {
  it('is a factory returning middleware', () => {
    expect(typeof requirePermission('users:read')).toBe('function');
  });
});
