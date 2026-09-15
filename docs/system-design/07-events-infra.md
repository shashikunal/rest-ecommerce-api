# 07 Events + Infra (Kafka/envelope/outbox-inbox/Redis/cache)

Topics (grouped, not excessive): `order.events`, `payment.events`, `inventory.events`, `notification.events`, `user.events`, `analytics.events` (+`.DLQ` each). Key=aggregateId; partitions: 3 start, scale with lag; ordering per aggregate only; groups: notify/analytics/audit/inv-projector; retry exp+jitter 3–5 →DLQ + quarantine; replay via 7d retention (idempotent handlers); schema `eventType vN` + backward-compat (additive only, consumers ignore unknown).
Envelope: eventId(uuid)/eventType(`order.created`)/eventVersion/occurredAt/producer/correlationId/causationId/aggregateId/payload/metadata. Naming: `{domain}.{past-tense}`.
Outbox: tx(biz+PENDING) → publisher (poll 5s + sweeper) → Kafka → SENT; crash: sweeper replays; consumer crash: redeliver → inbox dedupe → apply once; cleanup SENT>7d; replay safe (idempotent). Only cross-domain.
Redis: `rl:*`, `otp:*`, `login:fail:*`, `cache:*`, `idem:*`, `lock:coupon:*`; TTLs per Phase 0; fail-closed auth/pay. Cache: product/cat/config/flags 5–15m, write-invalidate, single-flight, 60s neg-cache; never PII/secrets/money-states.
