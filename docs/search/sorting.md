# Search Sorting & Deterministic Ordering

## 1. Supported Sort Options

Clients cannot supply arbitrary database field names. Only approved, whitelisted sort tokens are accepted:

| Sort Token | Sort Field | Direction | Default Use Case |
|---|---|---|---|
| `relevance` | Score (relevance) | Descending | Default when query `q` is present |
| `price_asc` | `product.minPrice.amountMinor` | Ascending | Low-to-high price discovery |
| `price_desc` | `product.minPrice.amountMinor` | Descending | High-to-low luxury discovery |
| `newest` | `product.createdAt` | Descending | Default when `q` is absent |
| `name_asc` | `product.title` | Ascending | Alphabetical catalog browsing |

---

## 2. Deterministic Tie-Breaking for Stable Pagination

When two products have identical sort values (e.g. both cost $99.00 or both were created in the same second), sorting purely by price or creation time is non-deterministic. Different database query plans or sharded partitions can return items in arbitrary order, causing:
- Duplicate items appearing on page 2 that were already shown on page 1.
- Missing items skipped entirely between page transitions.

### Solution: Compound Sort with Unique ID
Every sort order appends the immutable `product.id` as the final tie-breaker:
```typescript
let cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
if (query.sort === 'price_desc' || query.sort === 'newest' || query.sort === 'relevance') {
  cmp = -cmp;
}
if (cmp !== 0) return cmp;
return a.product.id.localeCompare(b.product.id);
```
This guarantees 100% stable, repeatable pagination across distributed nodes.
