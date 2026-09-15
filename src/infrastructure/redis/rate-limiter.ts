import type { EnvConfig } from '../../config/env';
import type { Logger } from '../../config/logger';
import { getRedisClient, isRedisConnected } from '../../config/redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number;
  retryAfter?: number;
}

export interface RateLimitPolicy {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
  keyPrefix: string;
  match?: { method?: string; pathPrefix?: string };
  failClosed?: boolean;
}

export interface RateLimiter {
  check(
    method: string,
    path: string,
    identifier: string,
    policy?: RateLimitPolicy,
  ): Promise<RateLimitResult>;
  getPolicy(method: string, path: string): RateLimitPolicy | null;
}

export function createRateLimiter(
  logger: Logger,
  _config: EnvConfig,
  overrides: Partial<Record<string, RateLimitPolicy>> = {},
): RateLimiter {
  const policies = buildDefaultPolicies().map((p) => overrides[p.scope] ?? p);

  function resolvePolicy(method: string, path: string): RateLimitPolicy | null {
    for (const p of policies) {
      if (p.match?.method && p.match.method !== method) continue;
      if (p.match?.pathPrefix && !path.startsWith(p.match.pathPrefix)) continue;
      if (!p.match) {
        if (p.scope === 'GLOBAL') return p;
        continue;
      }
      return p;
    }
    return policies.find((p) => p.scope === 'GLOBAL') ?? null;
  }

  return {
    async check(method, path, identifier, policy?) {
      const effectivePolicy = policy ?? resolvePolicy(method, path);
      if (!effectivePolicy) {
        return {
          allowed: true,
          remaining: Number.MAX_SAFE_INTEGER,
          limit: Number.MAX_SAFE_INTEGER,
          reset: Date.now(),
        };
      }
      const safeId = identifier.slice(0, 128) || 'anon';
      const key = `${effectivePolicy.keyPrefix}:${safeId}:${method}:${path.split('?')[0]}`;
      const client = getRedisClient();
      if (!client || !isRedisConnected()) {
        if (effectivePolicy.failClosed) {
          return {
            allowed: false,
            remaining: 0,
            limit: effectivePolicy.limit,
            reset: Date.now() + effectivePolicy.windowMs,
            retryAfter: Math.ceil(effectivePolicy.windowMs / 1000),
          };
        }
        logger.warn('Rate limiter Redis unavailable, failing open', {
          scope: effectivePolicy.scope,
        });
        return {
          allowed: true,
          remaining: effectivePolicy.limit,
          limit: effectivePolicy.limit,
          reset: Date.now() + effectivePolicy.windowMs,
        };
      }
      try {
        const now = Date.now();
        const ttlSec = Math.max(1, Math.ceil(effectivePolicy.windowMs / 1000));
        const count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, ttlSec, 'NX');
        }
        const remaining = Math.max(0, effectivePolicy.limit - count);
        const ttl = await client.ttl(key).catch(() => ttlSec);
        const reset = now + (ttl > 0 ? ttl * 1000 : effectivePolicy.windowMs);
        if (count > effectivePolicy.limit) {
          return {
            allowed: false,
            remaining: 0,
            limit: effectivePolicy.limit,
            reset,
            retryAfter: ttl > 0 ? ttl : ttlSec,
          };
        }
        return { allowed: true, remaining, limit: effectivePolicy.limit, reset };
      } catch (err) {
        logger.warn('Rate limiter error, failing open', { error: (err as Error).message });
        return {
          allowed: true,
          remaining: effectivePolicy.limit,
          limit: effectivePolicy.limit,
          reset: Date.now() + effectivePolicy.windowMs,
        };
      }
    },
    getPolicy(method, path) {
      return resolvePolicy(method, path);
    },
  };
}

export function buildDefaultPolicies(): RateLimitPolicy[] {
  return [
    { scope: 'GLOBAL', identifier: 'ip', limit: 200, windowMs: 60000, keyPrefix: 'rl:g' },
    {
      scope: 'LOGIN',
      identifier: 'ip+acct',
      limit: 5,
      windowMs: 900000,
      keyPrefix: 'rl:login',
      match: { method: 'POST', pathPrefix: '/api/v1/auth/login' },
      failClosed: true,
    },
    {
      scope: 'REGISTER',
      identifier: 'ip',
      limit: 10,
      windowMs: 3600000,
      keyPrefix: 'rl:register',
      match: { method: 'POST', pathPrefix: '/api/v1/auth/register' },
    },
    {
      scope: 'OTP',
      identifier: 'email',
      limit: 5,
      windowMs: 600000,
      keyPrefix: 'rl:otp',
      match: { pathPrefix: '/api/v1/auth/otp' },
      failClosed: true,
    },
    {
      scope: 'PASSWORD_RESET',
      identifier: 'email',
      limit: 3,
      windowMs: 3600000,
      keyPrefix: 'rl:pwreset',
      match: { pathPrefix: '/api/v1/auth/password' },
      failClosed: true,
    },
    {
      scope: 'CHECKOUT',
      identifier: 'user',
      limit: 10,
      windowMs: 60000,
      keyPrefix: 'rl:checkout',
      match: { pathPrefix: '/api/v1/checkout' },
    },
    {
      scope: 'PAYMENT',
      identifier: 'user',
      limit: 10,
      windowMs: 60000,
      keyPrefix: 'rl:pay',
      match: { pathPrefix: '/api/v1/payments' },
      failClosed: true,
    },
    {
      scope: 'TOKEN_REFRESH',
      identifier: 'user',
      limit: 30,
      windowMs: 3600000,
      keyPrefix: 'rl:token_refresh',
      match: { method: 'POST', pathPrefix: '/api/v1/auth/refresh' },
    },
    {
      scope: 'PROFILE_UPDATE',
      identifier: 'user',
      limit: 30,
      windowMs: 60000,
      keyPrefix: 'rl:profile',
      match: { method: 'PATCH', pathPrefix: '/api/v1/users/me' },
    },
    {
      scope: 'PHONE_CHANGE',
      identifier: 'user',
      limit: 5,
      windowMs: 600000,
      keyPrefix: 'rl:phone',
      match: { pathPrefix: '/api/v1/users/me/phone' },
      failClosed: true,
    },
    {
      scope: 'SESSION_LIST',
      identifier: 'user',
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:sessions_list',
      match: { method: 'GET', pathPrefix: '/api/v1/users/me/sessions' },
    },
    {
      scope: 'SESSION_REVOKE',
      identifier: 'user',
      limit: 20,
      windowMs: 60000,
      keyPrefix: 'rl:sessions_revoke',
      match: { pathPrefix: '/api/v1/users/me/sessions' },
    },
    {
      scope: 'DEACTIVATE',
      identifier: 'user',
      limit: 5,
      windowMs: 3600000,
      keyPrefix: 'rl:deactivate',
      match: { method: 'POST', pathPrefix: '/api/v1/users/me/deactivate' },
      failClosed: true,
    },
    {
      scope: 'SEARCH_SUGGESTIONS',
      identifier: 'ip',
      limit: 120,
      windowMs: 60000,
      keyPrefix: 'rl:search_sug',
      match: { method: 'GET', pathPrefix: '/api/v1/products/suggestions' },
    },
    {
      scope: 'SEARCH',
      identifier: 'ip',
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:search',
      match: { method: 'GET', pathPrefix: '/api/v1/products/search' },
    },
    {
      scope: 'CATALOG_READ',
      identifier: 'ip',
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:catalog_read',
      match: { method: 'GET', pathPrefix: '/api/v1/products' },
    },
    {
      scope: 'CATALOG_BROWSE',
      identifier: 'ip',
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:catalog_browse',
      match: { method: 'GET', pathPrefix: '/api/v1/categories' },
    },
    {
      scope: 'CATALOG_BRANDS',
      identifier: 'ip',
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:catalog_brands',
      match: { method: 'GET', pathPrefix: '/api/v1/brands' },
    },
    {
      scope: 'CATALOG_WRITE',
      identifier: 'user',
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:catalog_write',
      match: { pathPrefix: '/api/v1/products' },
    },
    {
      scope: 'CATALOG_TAXONOMY_WRITE',
      identifier: 'user',
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:catalog_taxonomy',
      match: { pathPrefix: '/api/v1/categories' },
    },
    {
      scope: 'MEDIA_UPLOAD',
      identifier: 'user',
      limit: 10,
      windowMs: 3600000,
      keyPrefix: 'rl:media_upload',
      match: { method: 'POST', pathPrefix: '/api/v1/media/upload-url' },
      failClosed: true,
    },
  ];
}
