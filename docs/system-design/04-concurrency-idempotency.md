# 04 Concurrency + 07 Idempotency (detailed)

Races → protection → result:
- Last SKU: conditional `$inc` (available>0) single winner; loser 409; reserve TTL 15m + sweeper release. No locks.
- Dup checkout/order: `Idempotency-Key` + unique(idemKey); concurrent dup → one executes, other replays stored response (request-hash match else 422).
- Pay callbacks: webhook idem + server-fetch verify; out-of-order → status machine ignores stale (version compare).
- Coupon final allowance: atomic usage `$inc` + per-user unique index + limits; optional 5s Redis lock only if contention proven.
- Order dual-write: guarded machine + version (`expectedVersion` else 409).
- Dup refund: idem key + state guard (only PAID→refundable).
- Kafka dup: inbox dedupe (inboxEvents) + idempotent handlers.
Redis for short-window (24h keys, fast replay); Mongo persists money-path keys (durable past Redis eviction).
Key format: `idem:{domain}:{uuid-v4}`; store req-hash + resp + status; TTL 24h Redis, 90d Mongo (money).
