# Cart — Interview Preparation

- **Why MongoDB for cart?** Single-doc atomic updates (`$inc` + version guard)
  give merge/compare-and-swap without transactions; flexible embedded lines;
  same primary DB as catalog (no second store); TTL index handles expiry.
- **Embedded vs separate CartItem collection?** Embedded: cart always read whole
  (≤50 lines), one indexed fetch, atomic cross-line updates. Separate collection
  only pays off for unbounded/shared carts — not our case.
- **Why not Redis as source of truth?** Ephemeral by policy (ADR-004): eviction
  = data loss, no durability/queries. Redis holds idempotency only.
- **Duplicate lines?** Line identity = normalized SKU; merge path uses
  `items.sku`-matched `$inc`, first-add path guards `'items.sku': {$ne}` —
  concurrent racers collapse via 409 → retry → merge.
- **Concurrent updates?** Optimistic `version` on every mutation; stale → 409
  `CONCURRENT_UPDATE`; client re-reads and retries.
- **Price changes?** Snapshot kept, `priceStale` flag on read; checkout (Phase 15)
  revalidates — cart never promises final price and never trusts client prices.
- **Why no inventory reservation?** Reservation needs expiry/compensation and
  belongs to checkout+inventory (Phases 14–15); cart is intent, not a hold.
- **Scale 100x?** `userId` sharding key, keep single-doc pattern, add batched
  catalog refresh + optional short-TTL read cache (never authoritative).
- **Guest carts?** Not implemented (no requirement approval). Design reserved:
  Redis-backed guest doc + login merge summing quantities under the 50-cap.
- **Retry-safe add?** `Idempotency-Key` → Redis stores response hash+body 24h;
  replay on match, 409 on key reuse with different body.
