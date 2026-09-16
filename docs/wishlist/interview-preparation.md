# Wishlist — Interview Preparation

- **Why persist?** Cross-device "save for later" must survive sessions; cheap
  single-doc-per-user writes, cursor reads.
- **Duplicate prevention?** App pre-check + conditional `$push` with `$nor` on
  the logical key — race-safe without a multikey unique index; dup → 200.
- **Deleted products?** Reference retained; read enriches to `REMOVED` so the
  list never breaks and the UI can explain/allow cleanup.
- **Millions of records?** One doc per user, `userId` unique index, bounded
  200-item array; shard by `userId` if needed.
- **Pagination?** Cursor on `(addedAt DESC, itemId DESC)`, limit ≤50 —
  deterministic under concurrent adds.
- **BOLA?** Every operation scoped to `{userId}` from auth context; foreign
  `itemId` yields 404; `check` only answers for the caller's list.
- **Kafka for wishlist?** No consumer in Phase 13 — logs only; future
  recommendation signals would reuse the existing outbox, not a new one.
