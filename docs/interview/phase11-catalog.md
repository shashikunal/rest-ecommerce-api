# Interview Prep — Product Catalog (Phase 11)

1. **Product vs Variant**: product = merchandising grouping (title, story,
   media); variant = purchasable SKU (attributes + price). Separation lets
   pricing/assortment change without rewriting marketing content.
2. **Why SKU**: immutable, globally unique business key that inventory, cart,
   and orders join on — stable across renames and redesigns.
3. **Variant modeling**: independent documents with `productId` ref +
   `attrSignature` uniqueness — avoids giant embedded arrays and allows
   per-variant lifecycle/pricing.
4. **Embedded vs referenced**: embed media refs (small, read-together);
   reference variants/categories/brands (independent lifecycles, unbounded
   growth, separate query patterns).
5. **Hierarchical categories**: one-level + materialized `path` — two indexed
   queries render the whole tree; no recursive CTEs, no graph DB.
6. **Cycle prevention**: structural — parents must be roots, parent links
   immutable after create. Cycles are unrepresentable, not just validated.
7. **SKU uniqueness**: service pre-check for fast 409s + unique index as the
   correctness backstop under races.
8. **Concurrent updates**: OCC `version` on products/variants; stale writes get
   409 with refetch semantics.
9. **Why OCC**: catalog edits are low-contention but high-blast-radius; OCC is
   lock-free and fails loud instead of silently clobbering.
10. **APIs for millions**: cursor pagination, projections, indexed sort keys,
    cache-aside reads, CDN-friendly cache headers.
11. **Caching details**: 5m product detail, 10m taxonomy; write-invalidate by
    prefix; fail-open to MongoDB.
12. **Invalidation**: every mutation path invalidates its prefix; versioned
    ETags make stale CDN entries detectable.
13. **Inventory separation**: stock is high-churn operational state with
    different consistency needs; embedding it would couple catalog deploys to
    reservation throughput and bloat reads.
14. **Pricing separation**: catalog holds the base `priceRef`; promotions and
    customer-specific pricing compute at checkout/cart time so catalog writes
    can't bypass pricing rules.
15. **Search as derived**: search needs ranking/facets the source of truth
    shouldn't shape; derive via events so the index rebuilds by replay.
16. **Kafka → index**: outbox → `commerce.search.events.v1` → indexer upserts
    `(aggregateId, eventVersion)`; partition key = product id preserves order.
17. **Rebuild**: replay topic to a fresh consumer group; versioned upserts make
    it idempotent.
18. **Order snapshots**: orders copy title/price/attrs at purchase time; later
    catalog edits never mutate history.
19. **Archive over delete**: references (carts, orders, analytics, audit) stay
    valid; `deletedAt` + status preserve queryability.
20. **100x**: read replicas, Redis, derived search, CDN (nothing premature now).
21. **Sharding**: hash on slug/category for products, `productId` for variants
    (co-locate via zone sharding if joins matter); taxonomy stays unsharded.
22. **Denormalized paths**: fast reads, rename cost — mitigated by immutable
    slugs making renames display-only.
23. **Mass assignment**: strict schemas + explicit service→repo field maps.
24. **Admin security**: Bearer + `products:*` permissions + audit on every
    mutation + stricter rate limits.
25. **Extraction later**: ports/adapters per entity mean splitting catalog out
    is a transport change, not a rewrite.
