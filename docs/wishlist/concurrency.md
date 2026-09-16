# Wishlist — Concurrency

- Double-add (two tabs): app pre-check + conditional `$push` guarded by `$nor`
  on the logical key — exactly one insert wins; loser re-reads and returns
  200 with the existing item (never 409, per contract).
- Add vs remove: `$push` / `$pull` are single-document atomic; worst case the
  client re-lists (cursor-stable ordering by `addedAt DESC, itemId DESC`).
- Retries: `Idempotency-Key` replay like cart.
- No locks, no second DB, no in-memory maps.
