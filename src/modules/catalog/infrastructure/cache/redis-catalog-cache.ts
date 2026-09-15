import type { Logger } from '@config/logger';

import type { CatalogCache } from '../../domain/ports/CatalogPorts';
import {
  BRAND_LIST_CACHE_KEY,
  CATEGORY_TREE_CACHE_KEY,
  cacheGet,
  cacheInvalidate,
  cacheSet,
  productCacheKey,
} from '../cache/catalog-cache';

export class RedisCatalogCache implements CatalogCache {
  constructor(private readonly logger: Logger) {}

  async get<T>(key: string): Promise<T | null> {
    return cacheGet<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await cacheSet(key, value, ttlSeconds, this.logger);
  }

  async invalidate(pattern: string): Promise<void> {
    await cacheInvalidate(pattern, this.logger);
  }
}

export { productCacheKey, CATEGORY_TREE_CACHE_KEY, BRAND_LIST_CACHE_KEY };
