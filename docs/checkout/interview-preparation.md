# Checkout — Interview Preparation

## Architecture

- **Why separate Cart and Checkout?** Cart is mutable shopping state
  (browsing-time, long-lived, display prices); checkout is a bounded purchase
  attempt with an immutable money snapshot, reservations, and expiry. Mixing
  them would let browsing mutate money.
- **Why snapshot?** So downstream (order, payment) can trust a fixed,
  versioned record instead of re-reading five moving sources. The snapshot
  carries `cartVersion` so any drift is detectable, not silently purchasable.
- **Cart changes mid-checkout?** Revalidation compares cart id + version +
  item set + quantities; any drift → `CART_CHANGED` and the checkout is
  marked failed. Optimistic, no locks.
- **Why no distributed transaction?** The saga is local orchestration:
  conditional checkout transitions + atomic inventory ops + compensating
  releases. A 2PC coordinator would add failure modes without benefit at
  single-monolith scale; `ready` + idempotent ports give Phase 16 a clean
  handoff instead.

## Inventory

- **Why reserve at checkout, not add-to-cart?** Reservations are bounded,
  expiring holds; carts are unbounded intent. Reserving on add would let
  window-shoppers starve buyers.
- **Overselling?** Impossible by construction: every unit moves through
  Phase 14 conditional updates; the load test proves 50 units serve exactly
  25 two-unit checkouts under 200-way contention.
- **Partial failure?** Compensating release of successes, then `failed` —
  never a half-held checkout. Releases are idempotent, so compensation
  retries are safe.
- **Expiration?** `expiresAt` + lazy expiry on access + bounded ADMIN/SYSTEM
  sweep; each expiry releases through the same idempotent path.

## Pricing / distributed systems

- **Client price?** Never trusted: strict schemas reject money fields, and
  totals are recomputed from catalog `priceRef`. A changed price marks the
  checkout `failed` with sku-level detail — the client rebuilds.
- **Coupons later?** `CheckoutPricingPort` + stored-but-unpriced
  `couponCode`: Phase 20 implements validation/application behind the same
  interface, no checkout rewrite.
- **Idempotency?** Two layers (Redis header replay + persisted
  `(userId, key, reqHash)`): same→replay, different→409, concurrent→one
  winner, restart-safe.
- **Outbox?** No checkout events exist (no topic, no consumers) — nothing to
  relay. Inventory legs already emit their own events; `order.created`
  (Phase 16) is the downstream integration event.

## Concurrency / scale / serverless

- **Two tabs, same cart?** Same key → same checkout; different keys → two
  checkouts, stock decides honestly at reserve.
- **Cancel vs expire race?** Conditional transition admits one winner; the
  loser replays (cancelled) or reports (expired). Releases are idempotent
  either way.
- **Millions of users?** Checkout docs are per-attempt uuid-keyed writes
  (no hot document); the hot spot remains the SKU inventory doc — partition
  by SKU when measured. Sweep and list are cursor-bounded.
- **Vercel?** No timers, no locks, no in-memory state: expiry is
  timestamp + invoked sweep; all coordination is Mongo conditionals.
