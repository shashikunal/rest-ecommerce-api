import { createHash } from 'crypto';

import type { Logger } from '@config/logger';
import { getRedisClient, isRedisConnected } from '@config/redis';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler } from '@shared/http/response';
import type { Request, Response, NextFunction } from 'express';

const IDEM_TTL_SECONDS = 24 * 60 * 60;

function hashPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload ?? null))
    .digest('hex');
}

export interface StoredIdempotencyRecord {
  reqHash: string;
  statusCode: number;
  body: unknown;
}

export async function replayIfDuplicate(
  logger: Logger,
  scope: string,
  key: string,
  reqHash: string,
): Promise<StoredIdempotencyRecord | null> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) return null;
  try {
    const raw = await client.get(`idem:${scope}:${key}`);
    if (!raw) return null;
    const record = JSON.parse(raw) as StoredIdempotencyRecord;
    if (record.reqHash !== reqHash) throw AppErrorFactory.idempotencyConflict();
    return record;
  } catch (error) {
    if ((error as { code?: string }).code === 'IDEMPOTENCY_CONFLICT') throw error;
    logger.warn('Idempotency lookup failed (ignored)', { error: (error as Error).message });
    return null;
  }
}

export async function storeIdempotencyResponse(
  logger: Logger,
  scope: string,
  key: string,
  reqHash: string,
  statusCode: number,
  body: unknown,
): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) return;
  try {
    await client.set(`idem:${scope}:${key}`, JSON.stringify({ reqHash, statusCode, body }), {
      EX: IDEM_TTL_SECONDS,
      NX: true,
    });
  } catch (error) {
    logger.warn('Idempotency store failed (ignored)', { error: (error as Error).message });
  }
}

export function idempotencyMiddleware(logger: Logger, scope: string) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key || typeof key !== 'string') {
      next();
      return;
    }
    if (key.length < 8 || key.length > 128) {
      throw AppErrorFactory.validation('Idempotency-Key', 'Idempotency-Key must be 8-128 chars');
    }
    const userId = (req as unknown as { user?: { id: string } }).user?.id ?? 'anon';
    const namespaced = `${userId}:${key}`;
    const reqHash = hashPayload({ method: req.method, path: req.path, body: req.body });
    const existing = await replayIfDuplicate(logger, scope, namespaced, reqHash);
    if (existing) {
      res.status(existing.statusCode).json(existing.body);
      return;
    }
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode < 500) {
        void storeIdempotencyResponse(logger, scope, namespaced, reqHash, res.statusCode, body);
      }
      return originalJson(body);
    }) as typeof res.json;
    next();
  });
}
