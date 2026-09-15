import { describe, it, expect } from 'vitest';

import {
  decodeSearchCursor,
  encodeSearchCursor,
  normalizeSearchQuery,
  normalizeSearchText,
  parseAttributes,
  searchCacheKey,
  SEARCH_LIMITS,
} from '../../../src/modules/catalog/application/search-normalization';
import type { SearchProductsQuery } from '../../../src/modules/catalog/domain/search/ProductSearchProvider';
import { AppError } from '../../../src/shared/errors/app-error';

describe('Search Normalization Unit Tests', () => {
  describe('normalizeSearchText', () => {
    it('returns undefined for empty, null, or undefined inputs', () => {
      expect(normalizeSearchText(undefined)).toBeUndefined();
      expect(normalizeSearchText(null)).toBeUndefined();
      expect(normalizeSearchText('')).toBeUndefined();
      expect(normalizeSearchText('   ')).toBeUndefined();
    });

    it('trims whitespace, collapses internal spaces, and lowercases text', () => {
      expect(normalizeSearchText('  Apple   iPhone   15 Pro  ')).toBe('apple iphone 15 pro');
    });

    it('strips ASCII control characters', () => {
      expect(normalizeSearchText('apple\u0000\u001Fiphone')).toBe('apple iphone');
    });

    it('throws validation error if input is not a string', () => {
      expect(() => normalizeSearchText(12345)).toThrow(AppError);
      expect(() => normalizeSearchText({ term: 'phone' })).toThrow(AppError);
    });

    it(`throws validation error if query exceeds max limit of ${SEARCH_LIMITS.maxQueryLength}`, () => {
      const longString = 'a'.repeat(SEARCH_LIMITS.maxQueryLength + 1);
      expect(() => normalizeSearchText(longString)).toThrow(AppError);
    });
  });

  describe('parseAttributes', () => {
    it('returns empty array when empty or undefined', () => {
      expect(parseAttributes(undefined)).toEqual([]);
      expect(parseAttributes(null)).toEqual([]);
      expect(parseAttributes('')).toEqual([]);
    });

    it('parses single attribute key:value string', () => {
      const parsed = parseAttributes('color:black');
      expect(parsed).toEqual([{ key: 'color', values: ['black'] }]);
    });

    it('parses comma-separated values and deduplicates them', () => {
      const parsed = parseAttributes('storage:128gb,256gb,128gb');
      expect(parsed).toEqual([{ key: 'storage', values: ['128gb', '256gb'] }]);
    });

    it('parses multiple attribute entries from array', () => {
      const parsed = parseAttributes(['color:red,blue', 'ram:16gb']);
      expect(parsed).toEqual([
        { key: 'color', values: ['red', 'blue'] },
        { key: 'ram', values: ['16gb'] },
      ]);
    });

    it('rejects invalid attribute key with special characters', () => {
      expect(() => parseAttributes('color$gt:red')).toThrow(AppError);
      expect(() => parseAttributes('color.name:red')).toThrow(AppError);
    });

    it('rejects more than allowed attribute filters', () => {
      const excessive = Array.from({ length: 9 }, (_, i) => `attr${i}:val`);
      expect(() => parseAttributes(excessive)).toThrow(AppError);
    });

    it('rejects non-string attribute input', () => {
      expect(() => parseAttributes([123 as unknown as string])).toThrow(AppError);
      expect(() => parseAttributes({ color: 'blue' } as unknown as string)).toThrow(AppError);
    });
  });

  describe('normalizeSearchQuery', () => {
    it('normalizes valid search query with default limit and sort', () => {
      const result = normalizeSearchQuery({
        q: 'Pixel 8',
      });
      expect(result.query).toBe('pixel 8');
      expect(result.sort).toBe('relevance');
      expect(result.limit).toBe(20);
      expect(result.attributes).toEqual([]);
    });

    it('defaults to newest sort when query is omitted', () => {
      const result = normalizeSearchQuery({});
      expect(result.sort).toBe('newest');
    });

    it('parses and converts price to minor units', () => {
      const result = normalizeSearchQuery({
        minPrice: '49.99',
        maxPrice: '150',
      });
      expect(result.minPriceMinor).toBe(4999);
      expect(result.maxPriceMinor).toBe(15000);
    });

    it('throws when minPrice > maxPrice', () => {
      expect(() =>
        normalizeSearchQuery({
          minPrice: '200',
          maxPrice: '100',
        }),
      ).toThrow('minPrice must be less than or equal to maxPrice');
    });

    it('rejects invalid sort option', () => {
      expect(() =>
        normalizeSearchQuery({
          sort: 'unknown_sort',
        }),
      ).toThrow('Unsupported search sort option');
    });

    it('rejects limit out of range (0 or > 50)', () => {
      expect(() => normalizeSearchQuery({ limit: 0 })).toThrow(AppError);
      expect(() => normalizeSearchQuery({ limit: 51 })).toThrow(AppError);
    });

    it('rejects malicious or invalid filter string characters', () => {
      expect(() => normalizeSearchQuery({ category: 'cat$ne' })).toThrow(AppError);
      expect(() => normalizeSearchQuery({ brand: '../etc/passwd' })).toThrow(AppError);
    });
  });

  describe('Cursor Pagination HMAC & Security', () => {
    it('encodes and successfully decodes a valid cursor', () => {
      const encoded = encodeSearchCursor({
        sort: 'price_asc',
        sortValue: 2999,
        productId: 'prod-123',
      });

      expect(typeof encoded).toBe('string');
      const decoded = decodeSearchCursor(encoded, 'price_asc');
      expect(decoded.sort).toBe('price_asc');
      expect(decoded.sortValue).toBe(2999);
      expect(decoded.productId).toBe('prod-123');
      expect(decoded.v).toBe(1);
    });

    it('rejects a tampered cursor payload or signature', () => {
      const encoded = encodeSearchCursor({
        sort: 'price_asc',
        sortValue: 2999,
        productId: 'prod-123',
      });

      // Tamper base64 content
      const tampered = `${encoded.slice(0, -6)}AAAAAA`;
      expect(() => decodeSearchCursor(tampered, 'price_asc')).toThrow(AppError);
    });

    it('rejects cursor when decoded sort does not match requested sort', () => {
      const encoded = encodeSearchCursor({
        sort: 'price_asc',
        sortValue: 2999,
        productId: 'prod-123',
      });

      expect(() => decodeSearchCursor(encoded, 'price_desc')).toThrow(AppError);
    });

    it('rejects non-base64 or malformed cursor strings', () => {
      expect(() => decodeSearchCursor('not-a-valid-cursor', 'newest')).toThrow(AppError);
    });
  });

  describe('searchCacheKey', () => {
    it('generates identical cache key regardless of attribute filter order', () => {
      const query1: SearchProductsQuery = {
        query: 'laptop',
        sort: 'relevance',
        limit: 20,
        attributes: [
          { key: 'color', values: ['silver', 'black'] },
          { key: 'ram', values: ['16gb', '32gb'] },
        ],
      };

      const query2: SearchProductsQuery = {
        query: 'laptop',
        sort: 'relevance',
        limit: 20,
        attributes: [
          { key: 'color', values: ['black', 'silver'] },
          { key: 'ram', values: ['32gb', '16gb'] },
        ],
      };

      expect(searchCacheKey(query1)).toBe(searchCacheKey(query2));
    });

    it('generates different keys for different search limits or sort orders', () => {
      const base: SearchProductsQuery = {
        query: 'laptop',
        sort: 'relevance',
        limit: 20,
        attributes: [],
      };

      const withDiffLimit: SearchProductsQuery = { ...base, limit: 10 };
      const withDiffSort: SearchProductsQuery = { ...base, sort: 'price_asc' };

      expect(searchCacheKey(base)).not.toBe(searchCacheKey(withDiffLimit));
      expect(searchCacheKey(base)).not.toBe(searchCacheKey(withDiffSort));
    });
  });
});
