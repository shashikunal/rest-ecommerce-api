# Database (Atlas) + Redis + Kafka + API plans

## MongoDB Atlas — docs/database/DESIGN.md
Collections: users,roles,permissions,sessions,products,categories,brands,productVariants,inventory,carts,wishlists,addresses,orders,payments,refunds,shipments,returns,coupons,promotions,reviews,notifications,notificationPreferences,auditLogs,outboxEvents,inboxEvents,idempotencyRecords.
- Embed vs ref: embed variant attrs/media/pricesnapshot+order items snapshot; ref user/product/category/coupon. Never trust client price — server calc + snapshot.
- Indexes: unique(email), unique(sku), unique(orderIdempotency), compound(productId+status), category+price, userId+createdAt, outbox(status+createdAt), TTL on sessions/OTP-refs/idempotency. Pagination: cursor (createdAt+_id) for catalog/orders; offset only admin small lists.
- Tx: checkout (order+inventory reserve+outbox), payment confirm (payment+order+outbox), refund (refund+order+outbox). Soft-delete catalog/coupons; audit append-only.

## Redis — docs/redis/PLAN.md
- Keys: `rl:{scope}:{id}:{endpoint}`, `otp:{purpose}:{contactHash}`, `otp:attempt:{id}`, `login:fail:{ip|acct}`, `cache:product:{id}`, `cache:cat:*`, `idem:{key}`, `lock:coupon:{code}` (short TTL).
- Cache-aside + invalidation on write, stampede via single-flight, neg-cache 60s, never cache PII/secrets. Fail: limits fail-closed (auth/pay), cache fail-through + alert.

## Kafka — docs/kafka/PLAN.md
Envelope: eventId/eventType/eventVersion/occurredAt/producer/correlationId/causationId/aggregateId/payload/metadata.
Topics: order.created/paid/cancelled, payment.succeeded/failed, inventory.reserved/released, notification.send, audit.record, analytics.track (+.DLQ each). Key=aggregateId, ordering per aggregate, groups per consumer, retries exp-backoff+jitter (3-5x) → DLQ + poison handling, idempotent inbox (inboxEvents dedupe), schema version+compat, retention 7d, lag alerts.
Outbox: tx writes business+outbox(PENDING)→publisher→Kafka→ack→MARK_SENT; sweeper + cleanup/retention/monitoring. Only cross-domain async.

## API — docs/api/PLAN.md
REST `/api/v1`, kebab resources, proper verbs/codes, error contract {code,message,status,requestId,correlationId,details?,timestamp}, Zod→400, cursor pagination, filter/sort/search params, versioning via URL, corrId header (x-correlation-id), Idempotency-Key on checkout/order/pay/refund/webhook, 429+RateLimit-*+Retry-After, OpenAPI+Swagger UI deliverable.
