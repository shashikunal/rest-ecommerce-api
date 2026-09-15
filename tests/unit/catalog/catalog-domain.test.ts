import { validateMediaRefs } from '@modules/catalog/application/ProductService';
import {
  canTransitionProductStatus,
  isPubliclyVisible,
} from '@modules/catalog/domain/entities/Product';
import { buildCategoryPath } from '@modules/catalog/domain/entities/Taxonomy';
import {
  assertValidSku,
  assertValidSlug,
  attributeSignature,
  normalizeAttrs,
  normalizeSku,
  slugify,
} from '@modules/catalog/domain/policies/catalog-policies';
import { describe, it, expect } from 'vitest';

describe('Product lifecycle', () => {
  it('allows draft -> published -> archived', () => {
    expect(canTransitionProductStatus('draft', 'published')).toBe(true);
    expect(canTransitionProductStatus('published', 'archived')).toBe(true);
    expect(canTransitionProductStatus('draft', 'archived')).toBe(true);
  });

  it('allows published -> draft (unpublish)', () => {
    expect(canTransitionProductStatus('published', 'draft')).toBe(true);
  });

  it('treats archived as terminal', () => {
    expect(canTransitionProductStatus('archived', 'draft')).toBe(false);
    expect(canTransitionProductStatus('archived', 'published')).toBe(false);
  });

  it('rejects draft -> draft and unknown jumps', () => {
    expect(canTransitionProductStatus('draft', 'draft')).toBe(false);
    expect(canTransitionProductStatus('published', 'published')).toBe(false);
  });

  it('exposes only published products publicly', () => {
    expect(isPubliclyVisible('published')).toBe(true);
    expect(isPubliclyVisible('draft')).toBe(false);
    expect(isPubliclyVisible('archived')).toBe(false);
  });
});

describe('SKU policy', () => {
  it('normalizes to upper-trim', () => {
    expect(normalizeSku('  px8-128-blk ')).toBe('PX8-128-BLK');
  });

  it('accepts valid SKUs', () => {
    expect(assertValidSku('PX8-128-BLK')).toBe('PX8-128-BLK');
  });

  it('rejects malformed SKUs', () => {
    expect(() => assertValidSku('ab')).toThrow();
    expect(() => assertValidSku('has space')).toThrow();
    expect(() => assertValidSku('-LEADING')).toThrow();
  });
});

describe('Slug policy', () => {
  it('slugifies titles deterministically', () => {
    expect(slugify('Pixel 8 Pro 128GB')).toBe('pixel-8-pro-128gb');
    expect(slugify('  Café & Co.  ')).toBe('cafe-co');
  });

  it('rejects malformed slugs', () => {
    expect(() => assertValidSlug('UPPER')).toThrow();
    expect(() => assertValidSlug('a')).toThrow();
    expect(() => assertValidSlug('-lead')).toThrow();
  });
});

describe('Variant attributes', () => {
  it('normalizes and validates keys', () => {
    expect(normalizeAttrs({ color: 'Red ', SIZE: 'M' })).toEqual({ color: 'Red', size: 'M' });
  });

  it('rejects unknown keys and empty sets', () => {
    expect(() => normalizeAttrs({ foo: 'bar' })).toThrow();
    expect(() => normalizeAttrs({})).toThrow();
    expect(() => normalizeAttrs({ color: '' })).toThrow();
  });

  it('builds order-independent signatures', () => {
    expect(attributeSignature({ size: 'M', color: 'red' })).toBe(
      attributeSignature({ color: 'red', size: 'M' }),
    );
    expect(attributeSignature({ color: 'red' })).not.toBe(attributeSignature({ color: 'blue' }));
  });
});

describe('Category paths', () => {
  it('builds materialized paths', () => {
    expect(buildCategoryPath(null, 'electronics')).toBe('/electronics');
    expect(buildCategoryPath('/electronics', 'smartphones')).toBe('/electronics/smartphones');
  });
});

describe('Media references', () => {
  const ref = (overrides = {}) => ({
    mediaId: 'm1',
    key: 'product/k1.jpg',
    url: 'https://cdn.test/product/k1.jpg',
    type: 'image/jpeg',
    sortOrder: 0,
    ...overrides,
  });

  it('accepts valid references', () => {
    expect(validateMediaRefs([ref()])).toHaveLength(1);
    expect(validateMediaRefs(undefined)).toEqual([]);
  });

  it('rejects over-limit, bad types, duplicate order', () => {
    expect(() =>
      validateMediaRefs(
        Array.from({ length: 11 }, (_, i) => ref({ mediaId: `m${i}`, sortOrder: i })),
      ),
    ).toThrow();
    expect(() => validateMediaRefs([ref({ type: 'image/gif' })])).toThrow();
    expect(() =>
      validateMediaRefs([ref({ mediaId: 'a', sortOrder: 0 }), ref({ mediaId: 'b', sortOrder: 0 })]),
    ).toThrow();
  });
});
