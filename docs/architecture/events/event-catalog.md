# Event Catalog (master; v1 unless noted; key = partition key)

Format per event: producer → topic(key) → consumers | ordering | retry→DLQ | replay-safe?
- user.registered (auth → user.events(userId) → notify[welcome mail], audit) | none | 3 →DLQ | yes (mail idem by eventId)
- user.emailVerified (auth → user.events(userId) → notify, audit) | per-user | 3 | yes
- user.passwordResetRequested (auth → user.events(userId) → notify[OTP mail]) | per-user | 3 | yes (OTP single-use guards resend)
- user.sessionRevoked (auth → user.events(userId) → audit) | per-user | 3 | yes
- catalog.productCreated/Updated/Published/Unpublished (catalog → catalog.events(productId) → search-indexer, audit) | per-product | 5 | yes (upsert by version)
- catalog.variantCreated/Updated (catalog → catalog.events(productId) → search-indexer, inventory-bootstrap) | per-product | 5 | yes
- inventory.adjusted (inventory → inventory.events(skuId) → audit) | per-sku | 3 | yes
- inventory.reserved (checkout → inventory.events(skuId) → order-guard, analytics) | per-sku | 5 | yes (reserve idem)
- inventory.released / inventory.committed (inventory → inventory.events(skuId) → order, analytics) | per-sku | 5 | yes
- inventory.lowStock (inventory → inventory.events(skuId) → notify-ops) | per-sku | 3 | yes
- cart.abandoned (sweeper → order.events(userId) → notify[reminder], analytics) | per-user | 2 | yes
- order.created (checkout → order.events(orderId) → payment-starter, notify, analytics, audit) | per-order strict | 5 | yes (create guarded by idemKey)
- order.confirmed / order.cancelled / order.processing / order.shipped / order.delivered (order → order.events(orderId) → notify/ship/analytics/audit) | per-order strict | 5 | yes (version-guarded transitions)
- payment.initiated/authorized/captured/failed/cancelled (payment → payment.events(orderId) → order, notify, analytics) | per-order strict | 5 | yes (server-verify + version)
- refund.initiated/completed (payment → payment.events(orderId) → order, notify) | per-order | 5 | yes (amount-cap + idem)
- return.requested/approved/rejected/received (returns → order.events(orderId) → notify, payment(refund), audit) | per-order | 5 | yes (RMA machine)
- notification.requested (any → notification.events(userId) → notify-worker) | per-user | 5→DLQ | yes (dedupe by eventId)
- notification.sent/failed (notify → notification.events(userId) → audit, analytics) | per-user | 3 | yes
- search.indexRequested/Updated/Removed (catalog → search.events(productId) → search-indexer) | per-product | 5 | yes (versioned upsert; full reindex via replay to fresh group)
- analytics.* : no dedicated analytics events — analytics consumer group re-reads order/payment/inventory/user events (avoids dual-publish).
Dropped as unjustified: CartCreated/Updated (request-scoped, no consumer), ProductDeleted (use Unpublished + hard-delete is ops-only).
