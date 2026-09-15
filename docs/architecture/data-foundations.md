# DB Foundation (Atlas — no models yet)

Collections (all justified): users,roles,permissions,sessions,products,productVariants,categories,brands,inventory,carts,wishlists,addresses,orders,payments,refunds,shipments,returns,coupons,promotions,reviews,notifications,notificationPreferences,auditLogs,outboxEvents,inboxEvents,idempotencyRecords.
- **Embed:** order items + price/tax/coupon snapshot + address snapshot; product attrs/small media. Why: immutable history, single-read.
- **Ref:** user↔orders, product↔variant/inventory, coupon↔order. Why: independent lifecycle, bounded arrays.
- **Queries:** by email/sku/idemKey; catalog by category+price+text; user orders by userId+createdAt; outbox by status+createdAt.
- **Indexes:** unique(email), unique(sku), unique(idemKey), compound{status,createdAt},{categoryId,price},{userId,createdAt}, text(name,desc); TTL sessions/idem/sent-outbox.
- **Tx boundaries:** checkout (reprice+reserve+order+outbox), pay-confirm (payment+order+outbox), refund (refund+order+outbox). **Concurrency:** conditional `$inc`, version, unique guards; no DIY locks (short Redis lock only if coupon contention proven).
- **Lifecycle:** soft-delete catalog/coupons; audit append-only; outbox cleanup post-ACK; Atlas continuous backup + PITR.

# Redis Foundation
Use: cache-aside (product/cat/config/flags 5–15m, write-invalidate, single-flight, 60s neg-cache; never PII/secrets) | OTP `otp:{purpose}:{hash}` 5–10m + attempt counters | throttles `login:fail:{ip|acct}` | limits `rl:{scope}:{id}:{route}` | idem `idem:{key}` 24h | short `lock:coupon:{code}` 5–10s. Eviction allkeys-lru; fail-closed limits on auth/pay, fail-through cache; monitor hit-rate/latency/errors.

# Rate Limiting Foundation (sliding-window default; token-bucket burst for search)
| Scope | Identity | Limit/Window | Key | Resp |
|---|---|---|---|---|
| Global | IP | 200/m | rl:g:{ip}:* | 429+Retry-After |
| Register | IP | 10/h | rl:reg:{ip} | 429 |
| Login | IP+acct | 5/15m | rl:login:{ip}:{acct} | 429, generic msg |
| OTP req | contact | 4/10m | rl:otp:{hash} | 429+cooldown |
| OTP verify | OTP id | 5/OTP | otp:att:{id} | 429/invalidate |
| Reset | acct | 3/15m | rl:rst:{acct} | 429 |
| Search | user/IP | 60/m burst10 | rl:search:{id} | 429 |
| Cart | user | 60/m | rl:cart:{uid} | 429 |
| Checkout | user | 10/m | rl:co:{uid} | 429+idem |
| Payment | user | 5/m | rl:pay:{uid} | 429+idem |
| Admin | user | 60/m | rl:adm:{uid} | 429+audit |
| Upload | user | 10/h | rl:up:{uid} | 429 |
| Webhook | provider | 100/m + HMAC | rl:wh:{prov} | 401/429 |
Why sliding: accurate per-window abuse control distributed via Redis; token-bucket only where burst legit (search). Fixed-window rejected (boundary spikes).
