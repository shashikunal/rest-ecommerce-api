import { SessionService } from '@modules/sessions/application/SessionService';
import { UserService } from '@modules/users/application/UserService';
import { ERROR_CODES } from '@shared/errors/error-codes';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  FakeEventPublisher,
  FakeOtpService,
  FakeSessionRepository,
  FakeTokenRepository,
  FakeUserRepository,
  makeSession,
  makeUser,
  testLogger,
} from '../../helpers/fakes';

describe('UserService', () => {
  let users: FakeUserRepository;
  let sessions: FakeSessionRepository;
  let tokens: FakeTokenRepository;
  let otp: FakeOtpService;
  let events: FakeEventPublisher;
  let service: UserService;

  beforeEach(() => {
    users = new FakeUserRepository();
    sessions = new FakeSessionRepository();
    tokens = new FakeTokenRepository();
    otp = new FakeOtpService();
    events = new FakeEventPublisher();
    service = new UserService(users, sessions, tokens, otp, events, testLogger);
    void users.save(makeUser());
  });

  it('returns public profile without secrets', async () => {
    const profile = await service.getMe('user-1');
    expect(profile.id).toBe('user-1');
    expect(profile).not.toHaveProperty('passwordHash');
  });

  it('rejects unknown users with USER_NOT_FOUND', async () => {
    await expect(service.getMe('missing')).rejects.toMatchObject({
      code: ERROR_CODES.USER_NOT_FOUND,
    });
  });

  it('blocks suspended and deactivated accounts', async () => {
    await users.save(makeUser({ id: 'suspended', status: 'SUSPENDED' }));
    await expect(service.getMe('suspended')).rejects.toMatchObject({
      code: ERROR_CODES.USER_SUSPENDED,
    });
    await users.save(makeUser({ id: 'dead', status: 'DEACTIVATED', isActive: false }));
    await expect(service.getMe('dead')).rejects.toMatchObject({
      code: ERROR_CODES.USER_DEACTIVATED,
    });
  });

  it('updates allowlisted profile fields and syncs display name', async () => {
    const profile = await service.updateProfile('user-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(profile.firstName).toBe('Ada');
    expect(profile.name).toBe('Ada Lovelace');
    expect(profile.version).toBe(1);
    expect(events.events.some((e) => e.type === 'USER_PROFILE_UPDATED')).toBe(true);
  });

  it('rejects stale versions with CONCURRENT_UPDATE', async () => {
    await service.updateProfile('user-1', { firstName: 'A', version: 0 });
    await expect(
      service.updateProfile('user-1', { firstName: 'B', version: 0 }),
    ).rejects.toMatchObject({ code: ERROR_CODES.CONCURRENT_UPDATE });
  });

  it('forces security notifications on in preferences', async () => {
    const profile = await service.updatePreferences('user-1', {
      securityNotifications: false,
      marketingEmails: true,
    });
    expect(profile.preferences.securityNotifications).toBe(true);
    expect(profile.preferences.marketingEmails).toBe(true);
  });

  it('rejects invalid preferences with INVALID_PROFILE', async () => {
    await expect(service.updatePreferences('user-1', { language: 'xx' })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_PROFILE,
    });
  });

  it('verifies phone change through OTP bound to user+phone', async () => {
    const { expiresAt } = await service.requestPhoneChange('user-1', '+15551234567');
    expect(expiresAt instanceof Date).toBe(true);
    const profile = await service.verifyPhoneChange('user-1', '+15551234567', '123456');
    expect(profile.phone).toBe('+15551234567');
    expect(profile.phoneVerified).toBe(true);
  });

  it('rejects phone verification with wrong OTP', async () => {
    await service.requestPhoneChange('user-1', '+15551234567');
    await expect(
      service.verifyPhoneChange('user-1', '+15551234567', '000000'),
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_PROFILE });
  });

  it('rejects malformed phone numbers', async () => {
    await expect(service.requestPhoneChange('user-1', 'not-a-phone')).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_PROFILE,
    });
  });

  it('deactivates account, revokes sessions and tokens', async () => {
    await sessions.create(makeSession());
    await tokens.saveToken({
      id: 't1',
      userId: 'user-1',
      token: 'raw',
      tokenType: 'refresh',
      isRevoked: false,
      isUsed: false,
      expiresAt: new Date(Date.now() + 1000),
      createdAt: new Date(),
    });
    const profile = await service.deactivate('user-1', 'leaving');
    expect(profile.status).toBe('DEACTIVATED');
    expect(await sessions.findById('session-1')).toMatchObject({ isActive: false });
    expect(await tokens.isTokenRevoked('t1')).toBe(true);
    await expect(service.getMe('user-1')).rejects.toMatchObject({
      code: ERROR_CODES.USER_DEACTIVATED,
    });
  });

  it('deactivation is idempotent', async () => {
    await service.deactivate('user-1');
    const again = await service.deactivate('user-1');
    expect(again.status).toBe('DEACTIVATED');
  });
});

describe('SessionService', () => {
  let users: FakeUserRepository;
  let sessions: FakeSessionRepository;
  let tokens: FakeTokenRepository;
  let events: FakeEventPublisher;
  let service: SessionService;

  beforeEach(() => {
    users = new FakeUserRepository();
    sessions = new FakeSessionRepository();
    tokens = new FakeTokenRepository();
    events = new FakeEventPublisher();
    service = new SessionService(users, sessions, tokens, events, testLogger);
    void users.save(makeUser());
  });

  it('lists sessions with current flag and safe fields only', async () => {
    await sessions.create(makeSession());
    await sessions.create(
      makeSession({ id: 'session-2', tokenId: 'access-jti-2', createdAt: new Date('2026-01-02') }),
    );
    const result = await service.listSessions('user-1', 'session-1', { limit: 20 });
    expect(result.data).toHaveLength(2);
    expect(result.data.find((s) => s.sessionId === 'session-1')?.current).toBe(true);
    expect(result.data.find((s) => s.sessionId === 'session-2')?.current).toBe(false);
    expect(JSON.stringify(result)).not.toContain('access-jti');
    expect(result.data[0]).toHaveProperty('platform');
  });

  it('paginates session lists with cursor', async () => {
    for (let i = 0; i < 5; i += 1) {
      await sessions.create(
        makeSession({
          id: `s-${i}`,
          tokenId: `jti-${i}`,
          createdAt: new Date(`2026-01-0${i + 1}T00:00:00.000Z`),
        }),
      );
    }
    const first = await service.listSessions('user-1', 's-0', { limit: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.pagination.hasMore).toBe(true);
    expect(first.pagination.nextCursor).not.toBeNull();
  });

  it('revokes own session and its tokens', async () => {
    await sessions.create(makeSession());
    const result = await service.revokeSession('user-1', 'session-1');
    expect(result).toEqual({ revoked: true, alreadyRevoked: false });
    expect(await sessions.findById('session-1')).toMatchObject({ isActive: false });
  });

  it('repeat revocation is idempotent', async () => {
    await sessions.create(makeSession());
    await service.revokeSession('user-1', 'session-1');
    const again = await service.revokeSession('user-1', 'session-1');
    expect(again).toEqual({ revoked: true, alreadyRevoked: true });
  });

  it('returns 404-safe SESSION_NOT_FOUND for foreign sessions (IDOR)', async () => {
    await users.save(makeUser({ id: 'user-2', email: 'b@example.com' }));
    await sessions.create(makeSession({ id: 'other', userId: 'user-2', tokenId: 'jti-other' }));
    await expect(service.revokeSession('user-1', 'other')).rejects.toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
    await expect(service.revokeSession('user-1', 'missing')).rejects.toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
  });

  it('revoke-others keeps current session only', async () => {
    await sessions.create(makeSession());
    await sessions.create(makeSession({ id: 'session-2', tokenId: 'jti-2' }));
    await sessions.create(makeSession({ id: 'session-3', tokenId: 'jti-3' }));
    const result = await service.revokeOtherSessions('user-1', 'session-1');
    expect(result.revokedCount).toBe(2);
    expect(await sessions.findById('session-1')).toMatchObject({ isActive: true });
    expect(await sessions.findById('session-2')).toMatchObject({ isActive: false });
  });

  it('concurrent double revoke stays consistent', async () => {
    await sessions.create(makeSession());
    const [first, second] = await Promise.all([
      service.revokeSession('user-1', 'session-1'),
      service.revokeSession('user-1', 'session-1'),
    ]);
    expect(first.revoked).toBe(true);
    expect(second.revoked).toBe(true);
    expect(await sessions.findById('session-1')).toMatchObject({ isActive: false });
  });
});
