# Search Caching & Resiliency Strategy

## 1. Cache Key Formulation

To prevent cache key collisions and ensure identical queries produce the exact same cache key, query parameters are normalized and sorted prior to hashing:

```typescript
export function searchCacheKey(query: SearchProductsQuery): string {
  const stable = JSON.stringify({
    ...query,
    attributes: query.attributes.map((a) => ({ key: a.key, values: [...a.values].sort() })),
  });
  return `search:v1:${createHash('sha256').update(stable).digest('hex')}`;
}
```

Key features:
- **Attribute Sorting**: `color:black,blue` and `color:blue,black` generate identical cache keys.
- **SHA-256 Hashing**: Prevents oversized Redis keys when queries contain multiple filters.
- **Version Prefix**: Namespaced with `search:v1:` to allow instant global key invalidation on schema changes.

---

## 2. TTL Policy
- **Search Queries**: `60 seconds` TTL.
- **Search Suggestions**: `60 seconds` TTL.
- **HTTP Cache-Control Header**: Returns `public, max-age=60` so browser and CDN edge caches can serve identical queries.

---

## 3. Cache Invalidation Triggers

Catalog mutations trigger targeted pattern invalidations:
- `ProductUpdated`, `ProductPublished`, `ProductUnpublished`, `ProductArchived` -> invalidates `search:*` and `suggest:*`.
- `VariantCreated`, `VariantUpdated`, `VariantDeleted` -> invalidates `search:*` and `suggest:*`.
- `CategoryCreated`, `CategoryUpdated`, `CategoryArchived` -> invalidates `search:*` and `suggest:*`.
- `BrandCreated`, `BrandUpdated`, `BrandArchived` -> invalidates `search:*` and `suggest:*`.

---

## 4. Redis Failure & Degraded Mode (Fail-Open)

If Redis encounters network partitions, high memory, or crashes:
- `cacheGet` catches the error, logs a warning, and returns `null` (cache miss).
- `cacheSet` logs non-blocking warning without failing the user request.
- The system gracefully degrades to direct provider execution without impacting search availability.
