# Checkout — Concurrency

- Two creates, same cart, same key → one checkout (persisted
  `(userId, idempotencyKey)` unique index; loser replays). Different keys →
  two independent checkouts (each self-consistent; stock contention resolves
  honestly at reserve time).
- Reserve vs cancel vs expire: all funnel through conditional
  `(status, version)` transitions — exactly one wins; losers replay or 409.
- Cart mutation mid-checkout: `cartVersion` + item-set anchoring detects any
  drift at validate/reserve time → `CART_CHANGED`, checkout marked failed.
  No cart locks (optimistic, short-lived).
- Stale address update → 409 `CHECKOUT_CONFLICT` via expected version.
- Same reservation keys retried concurrently → inventory's persisted-key
  convergence (one winner, payload-checked).
- No process-local locks anywhere; safe on serverless multi-instance.
