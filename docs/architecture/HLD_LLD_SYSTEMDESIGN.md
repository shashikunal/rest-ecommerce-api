# HLD + System Design + LLD (plan)

## HLD diagrams to author (Mermaid) — docs/hld/
- System context, containers (Vercel API / Atlas / Redis / Kafka+workers / SMTP / storage-CDN / gateway), components (modules), request flow, auth/OTP/session, checkout/order/pay/inventory, Kafka/outbox/inbox/notify, rate-limit/cache, deployment, security/trust+failure boundaries.
- Request flow: `Route→Middleware(auth,corrId,limit,validate)→Controller→Service→Domain→Repo→Mongo (+Redis/Kafka side-effects via outbox)`.

## System design — docs/system-design/
- Functional: actors (customer/admin/staff/support/system/externals) + capabilities per §4-5 of brief.
- NFR/SLO: avail 99.9%, p50<200ms p95<600ms p99<1200ms (read; checkout/pay p95<1200ms), throughput start 200rps → scale horizontal (Vercel) + Atlas/Redis scale, durability via Atlas PITR + Kafka retention 7d, consistency: strong in checkout/order tx, eventual cross-domain via events, RPO≤5m RTO≤30m. Assumptions vs requirements explicitly split.

## LLD per module — docs/lld/
Each: responsibilities/interfaces/classes/repos/DTOs/Zod/domain/state/errors/deps/DB+event+security+tests. Priority: Auth/Session/OTP/Product/Cart/Inventory/Checkout/Order/Payment/Refund/Coupon/Shipping/Return/Notify/Kafka/Redis/Limit.
- Order states: CREATED→PENDING_PAYMENT→PAID→PROCESSING→SHIPPED→DELIVERED (+CANCELLED/FAILED/RETURN_REQUESTED→RETURNED→REFUNDED); transition table + who/events/side-effects/idempotency.
- Inventory: available/reserved/sold; atomic `$inc`+conditions or tx; reserve TTL (15m), release on fail/expire/cancel/return.
- Concurrency: atomic ops + tx + version + unique idx + idempotency; no DIY distributed locks except short Redis lock for coupon/high-contention with justification.
