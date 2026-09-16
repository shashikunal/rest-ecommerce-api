# Inventory — Interview Preparation

## Inventory modeling

- **Why separate inventory from product?** Different write profile and
  lifecycle: catalog is read-heavy/published-versioned, inventory is
  write-contended with per-unit correctness. Separate collection, SKU grain,
  catalog holds only a derived availability badge.
- **How is available calculated?** `onHand - reserved`, derived on every read
  — never stored, so it cannot contradict the persisted counters.
- **How do you prevent negative inventory?** Conditional updates
  (`$expr: onHand - reserved >= qty`) make check-and-write one operation;
  the loser gets null → 409. No read-modify-write exists in the codebase.
- **When transactions vs single-doc atomicity?** Single-doc conditionals
  cover every Phase 14 invariant. Multi-doc transactions are reserved for
  Phase 15 checkout (order + payment-intent + reserve in one boundary);
  this module's primitives are designed to be called inside it.

## Reservations

- **Why reserve at checkout, not add-to-cart?** Cart is unbounded intent with
  no expiry discipline; reserving there would lock stock for window-shoppers.
  Reservation starts when commitment starts, with a bounded TTL.
- **How do reservations expire?** `expiresAt` + re-entrant sweep (bounded
  batch, ADMIN/SYSTEM boundary); each expiry is an idempotent release, so
  crashed or overlapping sweeps converge instead of double-releasing.
- **How do you avoid double release/confirm?** State-guarded transitions
  (`active → terminal` only); repeats replay current state with no stock
  movement. Deterministic movement keys make the ledger replay-proof too.
- **Retries?** Persisted `idempotencyKey` (unique index): same key + same
  payload replays, same key + different payload 409s, concurrent same-key
  racers compensate and converge on one winner.
- **Worker crash / Kafka down?** Sweep resumes from query; outbox rows stay
  PENDING for the publisher; sync stock truth never depends on the broker.

## Distributed systems

- **Exactly-once?** Not claimed. At-least-once delivery + idempotent
  receivers (unique keys, state guards) = effective once.
- **Why outbox?** The event write lives next to the business write in the
  same database, so a crash cannot produce "stock moved, nobody told";
  the relay (Phase 25) can retry independently.
- **Duplicates / replay / out-of-order?** `eventId` dedupes; handlers are
  state-conditional (bootstrap upsert, release guards), so replays are
  no-ops and ordering only matters per-SKU, which the topic key preserves.

## Scalability & serverless

- **100k reservations/sec?** Hot-SKU document contention is the bottleneck;
  answers: SKU partitioning, shorter TTLs, async reserve queues — only after
  measurement (current volume is orders of magnitude below this).
- **Sharding?** SKU (or region-hash of SKU at 1000x) as shard key; all
  operations are already SKU-scoped single-document writes.
- **Multi-warehouse?** Extend identity to `(warehouseId, sku)`; reservation
  takes an allocation policy. Explicitly not built (Phase 4 is SKU-keyed).
- **Vercel?** No in-process state, no timers, no locks: all coordination is
  Mongo conditionals + Redis TTLs; expiry runs as an invoked boundary, not
  a resident worker.
