import { toPublicProfile } from '@modules/users/domain/entities/UserProfile';
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
} from '@modules/users/domain/value-objects/Preferences';
import {
  canTransitionStatus,
  normalizeStatus,
} from '@modules/users/domain/value-objects/UserStatus';
import { describe, it, expect } from 'vitest';

import { makeUser } from '../../helpers/fakes';

describe('User status transitions', () => {
  it('allows PENDING_VERIFICATION -> ACTIVE', () => {
    expect(canTransitionStatus('PENDING_VERIFICATION', 'ACTIVE')).toBe(true);
  });

  it('allows ACTIVE -> SUSPENDED, LOCKED, DEACTIVATED', () => {
    expect(canTransitionStatus('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(canTransitionStatus('ACTIVE', 'LOCKED')).toBe(true);
    expect(canTransitionStatus('ACTIVE', 'DEACTIVATED')).toBe(true);
  });

  it('allows SUSPENDED -> ACTIVE and -> DEACTIVATED', () => {
    expect(canTransitionStatus('SUSPENDED', 'ACTIVE')).toBe(true);
    expect(canTransitionStatus('SUSPENDED', 'DEACTIVATED')).toBe(true);
  });

  it('treats DEACTIVATED as terminal for self-service', () => {
    expect(canTransitionStatus('DEACTIVATED', 'ACTIVE')).toBe(false);
    expect(canTransitionStatus('DEACTIVATED', 'SUSPENDED')).toBe(false);
  });

  it('rejects arbitrary jumps', () => {
    expect(canTransitionStatus('PENDING_VERIFICATION', 'DEACTIVATED')).toBe(false);
    expect(canTransitionStatus('ACTIVE', 'PENDING_VERIFICATION')).toBe(false);
  });

  it('normalizes unknown status to ACTIVE', () => {
    expect(normalizeStatus('BOGUS')).toBe('ACTIVE');
    expect(normalizeStatus('SUSPENDED')).toBe('SUSPENDED');
  });
});

describe('Preferences', () => {
  it('merges patch over defaults', () => {
    const merged = normalizePreferences(undefined, { marketingEmails: true, language: 'es' });
    expect(merged.marketingEmails).toBe(true);
    expect(merged.language).toBe('es');
    expect(merged.orderNotifications).toBe(DEFAULT_PREFERENCES.orderNotifications);
  });

  it('forces security notifications on even when disabled', () => {
    const merged = normalizePreferences(undefined, { securityNotifications: false });
    expect(merged.securityNotifications).toBe(true);
  });

  it('rejects unsupported language and currency', () => {
    expect(() => normalizePreferences(undefined, { language: 'xx' })).toThrow();
    expect(() => normalizePreferences(undefined, { currency: 'XXX' })).toThrow();
  });
});

describe('Public profile DTO', () => {
  it('never exposes passwordHash', () => {
    const profile = toPublicProfile(makeUser());
    expect(profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(profile)).not.toContain('hashed');
  });

  it('exposes safe identity fields with defaults', () => {
    const profile = toPublicProfile(makeUser({ preferences: undefined, version: undefined }));
    expect(profile.id).toBe('user-1');
    expect(profile.email).toBe('user@example.com');
    expect(profile.version).toBe(0);
    expect(profile.preferences.securityNotifications).toBe(true);
  });
});
