import type { Logger } from '@config/logger';
import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

import type { CatalogCache } from '../domain/ports/CatalogPorts';
import type {
  ProductSearchProvider,
  SearchProductsResult,
} from '../domain/search/ProductSearchProvider';

import {
  normalizeSearchQuery,
  normalizeSearchText,
  searchCacheKey,
  SEARCH_LIMITS,
} from './search-normalization';

export class ProductSearchService {
  constructor(
    private readonly provider: ProductSearchProvider,
    private readonly cache: CatalogCache,
    private readonly logger: Logger,
  ) {}

  async search(raw: Record<string, unknown>): Promise<SearchProductsResult> {
    const allowed = new Set([
      'q',
      'query',
      'category',
      'categoryId',
      'brand',
      'brandId',
      'attributes',
      'minPrice',
      'maxPrice',
      'availability',
      'sort',
      'limit',
      'cursor',
    ]);
    for (const key of Object.keys(raw)) {
      if (!allowed.has(key)) {
        throw new AppError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Unsupported search parameter',
        });
      }
    }
    const query = normalizeSearchQuery(raw);
    const key = searchCacheKey(query);
    const cached = await this.cache.get<SearchProductsResult>(key);
    if (cached) {
      return { ...cached, metadata: { ...cached.metadata, cached: true } };
    }
    const started = Date.now();
    const result = await this.provider.search(query);
    await this.cache.set(key, result, SEARCH_LIMITS.cacheTtlSeconds);
    this.logger.info('Product search completed', {
      provider: this.provider.name,
      durationMs: Date.now() - started,
      resultCount: result.items.length,
      zeroResults: result.items.length === 0,
      sort: query.sort,
      cached: false,
    });
    return result;
  }

  async suggest(
    rawQuery: unknown,
    rawLimit: unknown,
  ): Promise<{
    suggestions: string[];
    metadata: { query: string; cached: boolean; provider: string };
  }> {
    const query = normalizeSearchText(rawQuery);
    if (!query || query.length < 2)
      return {
        suggestions: [],
        metadata: { query: query ?? '', cached: false, provider: this.provider.name },
      };
    const limit = rawLimit === undefined ? 8 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new AppError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid suggestion limit',
      });
    }
    const key = `suggest:v1:${query}:${limit}`;
    const cached = await this.cache.get<string[]>(key);
    if (cached)
      return {
        suggestions: cached,
        metadata: { query, cached: true, provider: this.provider.name },
      };
    const suggestions = await this.provider.suggest(query, limit);
    await this.cache.set(key, suggestions, SEARCH_LIMITS.cacheTtlSeconds);
    this.logger.info('Product suggestions completed', {
      provider: this.provider.name,
      count: suggestions.length,
    });
    return { suggestions, metadata: { query, cached: false, provider: this.provider.name } };
  }

  async invalidateCache(): Promise<void> {
    await this.cache.invalidate('search:*');
    await this.cache.invalidate('suggest:*');
    this.logger.info('Product search and suggestion cache invalidated');
  }
}
