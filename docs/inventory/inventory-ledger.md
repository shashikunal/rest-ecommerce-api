# Inventory — Ledger

`inventory_movements` is the immutable audit trail behind every quantity
change. One entry per state change, written with before/after snapshots:

```text
{ inventoryId, sku, type, quantityDelta,
  previousOnHand, previousReserved, newOnHand, newReserved,
  reason, referenceType?, referenceId?, actorType, actorId,
  idempotencyKey?, correlationId, createdAt }
```

Movement types: `INIT` (bootstrap/create), `ADJUST`, `RESERVE`, `RELEASE`,
`EXPIRE`, `CONFIRM`. Reasons: the eight `AdjustmentReason` values for
`ADJUST`, plus `BOOTSTRAP`, `RESERVE`, `RELEASED`, `EXPIRED`, `CONFIRMED`.

Properties:

- Append-only: no update or delete path exists in repository code.
- Replay-convergent: deterministic keys (`<reservationId>:reserve|release|
expire|confirm`, caller-supplied adjust keys) with a sparse unique index —
  a retried operation re-inserts the same key and is ignored instead of
  double-posting.
- Read path: `GET /inventory/:id/movements`, cursor over
  `(createdAt DESC, _id DESC)`.
- Retention: no TTL. Movements are audit history; only reservations carry
  `expiresAt`, and expiry transitions state without deleting.
