# Checkout — Idempotency

Two layers, both required:

1. **Header (Redis, fast path).** Existing `idempotencyMiddleware(logger,
'checkout')` on all mutations: same key + same body hash → stored response
   replayed; different body → 409 `IDEMPOTENCY_CONFLICT`. Fail-open when Redis
   is down. `POST /checkout` additionally _requires_ the header (400 when
   absent, per the Phase 6 contract).
2. **Persisted (MongoDB, restart-safe).** Checkouts store
   `(userId, idempotencyKey, reqHash)` under a unique index. On create, a hit
   with matching hash replays the checkout (201→200); mismatched hash → 409;
   concurrent inserts collapse via duplicate-key → re-read → replay. Reserve
   lines use deterministic per-line keys (`<checkoutId>:<sku>`) so retries
   converge on the same inventory reservations.

No in-memory maps. Timeouts are safe to retry with the same key; process
restarts lose only the Redis layer, never correctness.
