# Wishlist — Testing

- Unit (`tests/unit/wishlist/wishlist.test.ts`): duplicate-safe add (200, same
  `itemId`), graceful `AVAILABLE→UNAVAILABLE→REMOVED` transitions, deterministic
  cursor pagination.
- API (`tests/integration/cart-wishlist.test.ts`): add/list/check/remove cycle,
  duplicate collapse, per-user isolation.
- Regression: included in the 193/193 full-suite run.

Performance notes (reviewed, not load-tested): cart/wishlist reads are single
indexed `userId` lookups + bounded catalog refresh (≤50 SKUs, individual
`findBySku` — acceptable at this scale; batch loader is the future hook if
carts grow). No N+1 beyond line count; no cart caching introduced (freshness
over speed for mutable snapshots).
