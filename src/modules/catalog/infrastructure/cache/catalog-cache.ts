import type { Logger } from '@config/logger';
import { getRedisClient, isRedisConnected } from '@config/redis';

const KEY_PREFIX = 'catalog:';
const DEFAULT_TTL_SECONDS = 300;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) return null;
  try {
    const raw = await client.get(`${KEY_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  logger?: Logger,
): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) return;
  try {
    await client.setEx(`${KEY_PREFIX}${key}`, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger?.warn('Catalog cache set failed (non-blocking)', {
      error: (error as Error).message,
    });
  }
}

export async function cacheInvalidate(pattern: string, logger?: Logger): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) return;
  try {
    const keys = await client.keys(`${KEY_PREFIX}${pattern}`);
    if (keys.length > 0) await client.del(keys);
  } catch (error) {
    logger?.warn('Catalog cache invalidate failed (non-blocking)', {
      error: (error as Error).message,
    });
  }
}

export function productCacheKey(slugOrId: string): string {
  return `product:${slugOrId.toLowerCase()}`;
}

export const CATEGORY_TREE_CACHE_KEY = 'categories:tree';
export const BRAND_LIST_CACHE_KEY = 'brands:list';
