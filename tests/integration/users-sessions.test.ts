import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { createApp } from '../../src/app/app';
import { envSchema } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';
import type { AuthRequest } from '../../src/modules/auth/middleware/auth.middleware';
import { createSessionRoutes } from '../../src/modules/sessions/presentation/routes/sessions.routes';
import { createUserRoutes } from '../../src/modules/users/presentation/routes/users.routes';
import {
  FakeEventPublisher,
  FakeOtpService,
  FakeSessionRepository,
  FakeTokenRepository,
  FakeUserRepository,
  makeSession,
  makeUser,
  testLogger,
} from '../helpers/fakes';

const config = envSchema.parse({
  MONGODB_URI: 'mongodb://localhost:27017/test',
  REDIS_URL: 'redis://localhost:6379',
  KAFKA_BROKERS: 'localhost:9092',
  KAFKA_CLIENT_ID: 'test',
  KAFKA_GROUP_ID: 'test-group',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CORS_ORIGINS: 'http://localhost:3000',
  FEATURE_SWAGGER_UI: false,
});
const logger = createLogger(config);

const SESSION_A = '123e4567-e89b-42d3-a456-426614174001';
const SESSION_B = '123e4567-e89b-42d3-a456-426614174002';
const SESSION_FOREIGN = '123e4567-e89b-42d3-a456-426614174003';

function stubAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const userId = req.headers['x-test-user'] as string | undefined;
  const sessionId = (req.headers['x-test-session'] as string | undefined) ?? SESSION_A;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Access token required' },
    });
    return;
  }
  req.user = {
    id: userId,
    email: `${userId}@example.com`,
    roles: ['user'],
    sessionId,
    correlationId: req.correlationId ?? '',
  };
  next();
}

describe('Users + Sessions API', () => {
  let users: FakeUserRepository;
  let sessions: FakeSessionRepository;
  let tokens: FakeTokenRepository;
  let otp: FakeOtpService;
  let events: FakeEventPublisher;

  function app() {
    const shared = {
      userRepository: users,
      sessionRepository: sessions,
      tokenRepository: tokens,
      otpService: otp,
      eventPublisher: events,
      logger: testLogger,
      authMiddleware: stubAuthMiddleware,
    };
    return createApp({
      config,
      logger,
      userRoutes: createUserRoutes(shared),
      sessionRoutes: createSessionRoutes(shared),
    });
  }

  beforeEach(() => {
    users = new FakeUserRepository();
    sessions = new FakeSessionRepository();
    tokens = new FakeTokenRepository();
    otp = new FakeOtpService();
    events = new FakeEventPublisher();
    void users.save(makeUser());
    void sessions.create(makeSession({ id: SESSION_A, tokenId: 'access-jti-a' }));
  });

  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app()).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('returns current user without secrets', async () => {
    const res = await request(app()).get('/api/v1/users/me').set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('user-1');
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(res.body.correlationId).toBeDefined();
  });

  it('updates profile with allowlisted fields only', async () => {
    const ok = await request(app())
      .patch('/api/v1/users/me')
      .set('x-test-user', 'user-1')
      .send({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.firstName).toBe('Ada');
    expect(ok.body.data.roles).toEqual(['user']);
    expect(ok.body.data.status).toBe('ACTIVE');
  });

  it('rejects protected-field injection with 400 (mass assignment)', async () => {
    const res = await request(app())
      .patch('/api/v1/users/me')
      .set('x-test-user', 'user-1')
      .send({ firstName: 'Ada', roles: ['admin'], status: 'SUSPENDED' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown profile fields (strict validation)', async () => {
    const res = await request(app())
      .patch('/api/v1/users/me')
      .set('x-test-user', 'user-1')
      .send({ nickname: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized profile payload', async () => {
    const res = await request(app())
      .patch('/api/v1/users/me')
      .set('x-test-user', 'user-1')
      .send({ firstName: 'x'.repeat(500) });
    expect(res.status).toBe(400);
  });

  it('returns 409 on stale version', async () => {
    await request(app())
      .patch('/api/v1/users/me')
      .set('x-test-user', 'user-1')
      .send({ firstName: 'First' });
    const res = await request(app())
      .patch('/api/v1/users/me')
      .set('x-test-user', 'user-1')
      .send({ firstName: 'Second', version: 0 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONCURRENT_UPDATE');
  });

  it('updates preferences and forces security notifications', async () => {
    const res = await request(app())
      .patch('/api/v1/users/me/preferences')
      .set('x-test-user', 'user-1')
      .send({ marketingEmails: true, securityNotifications: false });
    expect(res.status).toBe(200);
    expect(res.body.data.preferences.marketingEmails).toBe(true);
    expect(res.body.data.preferences.securityNotifications).toBe(true);
  });

  it('lists sessions with current flag and pagination envelope', async () => {
    const res = await request(app())
      .get('/api/v1/users/me/sessions?limit=20')
      .set('x-test-user', 'user-1')
      .set('x-test-session', SESSION_A);
    expect(res.status).toBe(200);
    expect(res.body.data.sessions).toHaveLength(1);
    expect(res.body.data.sessions[0].current).toBe(true);
    expect(res.body.data.sessions[0]).not.toHaveProperty('tokenId');
    expect(res.body.data.pagination.limit).toBe(20);
  });

  it('rejects invalid session list query', async () => {
    const res = await request(app())
      .get('/api/v1/users/me/sessions?limit=999')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(400);
  });

  it('revokes own session idempotently', async () => {
    const first = await request(app())
      .delete(`/api/v1/users/me/sessions/${SESSION_A}`)
      .set('x-test-user', 'user-1');
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ revoked: true, alreadyRevoked: false });
    const second = await request(app())
      .delete(`/api/v1/users/me/sessions/${SESSION_A}`)
      .set('x-test-user', 'user-1');
    expect(second.body.data).toEqual({ revoked: true, alreadyRevoked: true });
  });

  it('blocks cross-user session revocation with 404 (IDOR)', async () => {
    await users.save(makeUser({ id: 'user-2', email: 'b@example.com' }));
    await sessions.create(
      makeSession({ id: SESSION_FOREIGN, userId: 'user-2', tokenId: 'jti-other' }),
    );
    const res = await request(app())
      .delete(`/api/v1/users/me/sessions/${SESSION_FOREIGN}`)
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('rejects malformed session id with 400', async () => {
    const res = await request(app())
      .delete('/api/v1/users/me/sessions/not-a-uuid')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(400);
  });

  it('revoke-others keeps current session', async () => {
    await sessions.create(makeSession({ id: SESSION_B, tokenId: 'jti-b' }));
    const res = await request(app())
      .post('/api/v1/users/me/sessions/revoke-others')
      .set('x-test-user', 'user-1')
      .set('x-test-session', SESSION_A);
    expect(res.status).toBe(200);
    expect(res.body.data.revokedCount).toBe(1);
    expect(res.body.data.currentSessionId).toBe(SESSION_A);
  });

  it('phone change requires OTP verification', async () => {
    const requested = await request(app())
      .post('/api/v1/users/me/phone/request')
      .set('x-test-user', 'user-1')
      .send({ phone: '+15551234567' });
    expect(requested.status).toBe(200);
    const verified = await request(app())
      .post('/api/v1/users/me/phone/verify')
      .set('x-test-user', 'user-1')
      .send({ phone: '+15551234567', otp: '123456' });
    expect(verified.status).toBe(200);
    expect(verified.body.data.phoneVerified).toBe(true);
  });

  it('deactivates account and blocks subsequent access', async () => {
    const res = await request(app())
      .post('/api/v1/users/me/deactivate')
      .set('x-test-user', 'user-1')
      .send({ reason: 'leaving' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DEACTIVATED');
    const after = await request(app()).get('/api/v1/users/me').set('x-test-user', 'user-1');
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('USER_DEACTIVATED');
  });
});
