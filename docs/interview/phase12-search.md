# Phase 12 Search — Interview Notes

1. Search is separated from source truth so catalog writes stay correct while search scales/read-optimizes independently.
2. MongoDB search is acceptable at this scale; OpenSearch is introduced for advanced relevance, facets, high cardinality, and independent scaling.
3. Introduce a dedicated search engine when text relevance, faceting, traffic, or query latency exceed MongoDB comfort.
4. Async indexing: catalog write + outbox, worker publishes Kafka, search consumer updates projection.
5. Eventual consistency means search can lag catalog briefly.
6. Rebuild index by scanning MongoDB source and backfilling a new versioned index.
7. Duplicate events are handled idempotently using aggregate id/version.
8. Out-of-order events are rejected when event version/updatedAt is stale.
9. Stale results are limited by short TTL, invalidation events, and version checks.
10. Cursor pagination encodes stable sort value + product id.
11. Offset pagination is easy but slow/inconsistent for deep pages; cursor is stable and scalable.
12. Stable sorting prevents duplicate/missing rows between pages.
13. Facets should be powered by search/index aggregations, not unbounded OLTP scans.
14. Cache query result pages by normalized query hash.
15. Invalidate via short TTL/versioned keys; avoid enumerating all search keys.
16. Prevent stampede with TTL jitter/request coalescing in future.
17. Protect from bots using backend rate limits/WAF/caps.
18. Prevent expensive queries with whitelisted filters, limits, cursor caps, no raw operators.
19. Zero-result searches are telemetry candidates with privacy controls.
20. Improve relevance via exact/prefix/brand/category boosts and later analyzers/synonyms.
21. Autocomplete scales with prefix index or completion suggester.
22. 100M products need dedicated search clusters, shards, replicas, async indexing, caching.
23. Millions of SKUs require SKU-specific fields and careful shard routing.
24. Zero-downtime reindex: build v2, backfill, validate, alias switch, retire v1.
25. Search outage returns controlled failure or deliberate fallback, not uncontrolled DB overload.
26. Inventory should not tightly couple to search; expose projected availability only.
27. Product updates during async indexing use version/updatedAt conflict checks.
28. Frontend debounce reduces UX traffic but is not backend security.
29. Search scales independently through provider abstraction and external index.
30. Atlas Search is convenient with MongoDB; OpenSearch gives broader search operations/control.
