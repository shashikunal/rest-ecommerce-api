# 01 Domain→Collection Map + Collection Catalog (Atlas primary; Redis/Kafka never truth)

| Domain | Collection | Owner | Access |
|---|---|---|---|
| identity | users | users-svc | by emailNormalized (login), by _id |
| identity | sessions | auth-svc | by tokenHash (refresh), by userId (list/revoke) |
| catalog | products | catalog-svc | by slug, by category+price, $text |
| catalog | productVariants | catalog-svc | by sku, by productId |
| catalog | categories | catalog-svc | tree read, by slug |
| catalog | brands | catalog-svc | by slug |
| pricing | (fields on variant + promotions) | pricing-svc | read current price |
| cart | carts | cart-svc | by userId |
| cart | wishlists | cart-svc | by userId |
| identity | addresses | users-svc | by userId |
| inventory | inventory | inventory-svc | by skuId (cond-inc) |
| inventory | inventoryReservations | inventory-svc | by orderId, by skuId+active, by expiresAt |
| order | orders | order-svc | by orderNo, by userId+createdAt |
| payment | payments | payment-svc | by idemKey, by providerRef, by orderId |
| payment | paymentWebhooks | payment-svc | by providerEventId (dedupe) |
| refund/return | refunds | payment-svc | by rmaId, by orderId |
| refund/return | returns | return-svc | by rmaId, by orderId |
| coupon | coupons | pricing-svc | by codeNormalized |
| coupon | promotions | pricing-svc | by window+status |
| review | reviews | review-svc | by product+status, by user |
| notify | notifications | notify-svc | by user+createdAt; TTL 90d |
| notify | notificationPreferences | notify-svc | by userId |
| platform | auditLogs | audit-svc | append-only, by actor/ts |
| infra | outboxEvents | publisher | by status+createdAt (claim) |
| infra | inboxEvents | dispatcher | by (consumer,eventId) |
| infra | idempotencyRecords | owner-svc | by key |

Catalog (size/growth/ratio/retention): users ~1KB, +800/mo, R-heavy, retain forever (soft-delete); sessions ~0.5KB, high-churn, TTL on expiresAt; products ~4KB (+media refs, never blobs), 20k base, R-heavy, soft-delete; variants ~1KB; carts ~2KB (cap 50 lines), TTL 30d abandoned; orders ~6KB immutable, +500/d, retain 7y; payments/refunds small, retain 7y; inventory tiny, hot-write; reservations tiny, TTL on expiry + sweep; coupons/promos small; reviews ~1KB; notifications ~1KB TTL 90d; audit ~0.5KB append-only 2y+; outbox/inbox tiny, SENT/PROCESSED cleanup 7d/30d; idem ~0.5KB TTL 90d (money).
Tx only: checkout (reserve+order+outbox), pay-confirm, refund, RMA-refund. Concurrency: cond-inc (inventory, coupon caps) + version-guarded transitions (orders/payments/carts/coupons/refunds). Sensitivity: users/sessions/payments highly sensitive (hashes only, never raw secrets/cards/OTPs); orders PII-limited snapshots; audit excludes secrets.
