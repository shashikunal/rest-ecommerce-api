import { createHash, timingSafeEqual } from 'crypto';

import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

import type {
  SearchAttributeFilter,
  SearchProductsQuery,
  SearchSort,
} from '../domain/search/ProductSearchProvider';

export const SEARCH_LIMITS = {
  maxQueryLength: 100,
  maxLimit: 50,
  maxCursorLength: 500,
  maxAttributeFilters: 8,
  maxAttributeValues: 5,
  maxAttributeKeyLength: 32,
  maxAttributeValueLength: 64,
  cacheTtlSeconds: 60,
  cursorTtlMs: 1000 * 60 * 60 * 6,
};

const CURSOR_SECRET = 'phase12-search-cursor-v1';

export interface SearchCursorPayload {
  v: 1;
  sort: SearchSort;
  sortValue: string | number;
  productId: string;
  issuedAt: number;
}

function badRequest(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code: ERROR_CODES.VALIDATION_ERROR, message, details });
}

export function normalizeSearchText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw badRequest('Search query must be a string');
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;
  if (normalized.length > SEARCH_LIMITS.maxQueryLength) {
    throw badRequest(`Search query exceeds ${SEARCH_LIMITS.maxQueryLength} characters`);
  }
  return normalized;
}

export function parseAttributes(raw: unknown): SearchAttributeFilter[] {
  if (raw === undefined || raw === null || raw === '') return [];
  const values = Array.isArray(raw) ? raw : [raw];
  if (values.length > SEARCH_LIMITS.maxAttributeFilters) {
    throw badRequest('Too many attribute filters');
  }
  const filters: SearchAttributeFilter[] = [];
  for (const entry of values) {
    if (typeof entry !== 'string') throw badRequest('Attribute filters must be strings');
    const [rawKey, rawValues] = entry.split(':', 2);
    const key = rawKey?.trim().toLowerCase();
    if (!key || !/^[a-z0-9_-]+$/.test(key) || key.length > SEARCH_LIMITS.maxAttributeKeyLength) {
      throw badRequest('Invalid attribute filter key');
    }
    const attrValues = (rawValues ?? '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (attrValues.length === 0 || attrValues.length > SEARCH_LIMITS.maxAttributeValues) {
      throw badRequest('Invalid attribute filter values');
    }
    for (const v of attrValues) {
      if (v.length > SEARCH_LIMITS.maxAttributeValueLength || !/^[\w\s.+-]+$/u.test(v)) {
        throw badRequest('Invalid attribute filter value');
      }
    }
    filters.push({ key, values: [...new Set(attrValues)] });
  }
  return filters;
}

export function normalizeSearchQuery(input: {
  q?: unknown;
  query?: unknown;
  category?: unknown;
  categoryId?: unknown;
  brand?: unknown;
  brandId?: unknown;
  attributes?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  availability?: unknown;
  sort?: unknown;
  limit?: unknown;
  cursor?: unknown;
}): SearchProductsQuery {
  const query = normalizeSearchText(input.q ?? input.query);
  const sort = (input.sort ?? (query ? 'relevance' : 'newest')) as SearchSort;
  if (!['relevance', 'price_asc', 'price_desc', 'newest', 'name_asc'].includes(sort)) {
    throw badRequest('Unsupported search sort option');
  }
  const limit = input.limit === undefined ? 20 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_LIMITS.maxLimit) {
    throw badRequest(`limit must be between 1 and ${SEARCH_LIMITS.maxLimit}`);
  }
  const toString = (v: unknown): string | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v !== 'string') throw badRequest('Filter values must be strings');
    if (v.length > 120) throw badRequest('Filter value too long');
    if (!/^[a-zA-Z0-9_-]+$/.test(v)) throw badRequest('Invalid filter value');
    return v.toLowerCase();
  };
  const toMoneyMinor = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100000000) throw badRequest('Invalid price filter');
    return Math.round(n * 100);
  };
  const minPriceMinor = toMoneyMinor(input.minPrice);
  const maxPriceMinor = toMoneyMinor(input.maxPrice);
  if (minPriceMinor !== undefined && maxPriceMinor !== undefined && minPriceMinor > maxPriceMinor) {
    throw badRequest('minPrice must be less than or equal to maxPrice');
  }
  let cursor: string | undefined;
  if (input.cursor !== undefined && input.cursor !== null && input.cursor !== '') {
    if (typeof input.cursor !== 'string') throw badRequest('Cursor must be a string');
    if (input.cursor.length > SEARCH_LIMITS.maxCursorLength) throw badRequest('Cursor too large');
    if (!/^[A-Za-z0-9_-]+$/.test(input.cursor)) throw badRequest('Invalid cursor');
    cursor = input.cursor;
  }
  const availability = toString(input.availability);
  if (availability && !['in_stock', 'out_of_stock', 'unknown'].includes(availability)) {
    throw badRequest('Invalid availability filter');
  }
  return {
    query,
    categorySlug: toString(input.category),
    categoryId: toString(input.categoryId),
    brandSlug: toString(input.brand),
    brandId: toString(input.brandId),
    attributes: parseAttributes(input.attributes),
    minPriceMinor,
    maxPriceMinor,
    availability: availability as SearchProductsQuery['availability'],
    sort,
    limit,
    cursor,
  };
}

function signPayload(payload: string): string {
  return createHash('sha256').update(`${payload}.${CURSOR_SECRET}`).digest('hex');
}

export function encodeSearchCursor(payload: Omit<SearchCursorPayload, 'v' | 'issuedAt'>): string {
  const body = JSON.stringify({ ...payload, v: 1, issuedAt: Date.now() });
  const sig = signPayload(body);
  return Buffer.from(JSON.stringify({ body, sig })).toString('base64url');
}

export function decodeSearchCursor(raw: string, expectedSort: SearchSort): SearchCursorPayload {
  try {
    if (raw.length > SEARCH_LIMITS.maxCursorLength) throw new Error('too_large');
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as {
      body: string;
      sig: string;
    };
    const expected = signPayload(parsed.body);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.sig)))
      throw new Error('bad_sig');
    const payload = JSON.parse(parsed.body) as SearchCursorPayload;
    if (payload.v !== 1 || payload.sort !== expectedSort || !payload.productId)
      throw new Error('invalid');
    if (Date.now() - payload.issuedAt > SEARCH_LIMITS.cursorTtlMs) throw new Error('expired');
    return payload;
  } catch {
    throw new AppError({ code: ERROR_CODES.INVALID_CURSOR, message: 'Invalid pagination cursor' });
  }
}

export function searchCacheKey(query: SearchProductsQuery): string {
  const stable = JSON.stringify({
    ...query,
    attributes: query.attributes.map((a) => ({ key: a.key, values: [...a.values].sort() })),
  });
  return `search:v1:${createHash('sha256').update(stable).digest('hex')}`;
}
