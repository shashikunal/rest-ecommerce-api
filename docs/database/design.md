# Database (Atlas) Design

Collections: users,roles,permissions,sessions,products,categories,brands,productVariants,inventory,carts,wishlists,addresses,orders,payments,refunds,shipments,returns,coupons,promotions,reviews,notifications,notificationPreferences,auditLogs,outboxEvents,inboxEvents,idempotencyRecords.
- **Embed:** order items + price snapshot; product attrs/media-small; address snapshot in order. Why: immutable history, single-read.
- **Ref:** user→orders, product→variant/inventory, coupon→order. Why: avoid unbounded arrays, allow independent lifecycle.
- **Indexes:** unique(email), unique(sku), unique(idemKey), compound{status,createdAt},{categoryId,price},{userId,createdAt}, text(name,desc); TTL sessions/idem/outbox-sent. Queries drive each.
- **Tx:** checkout / pay-confirm / refund (business+outbox atomically). **Concurrency:** conditional `$inc`, version field, unique guards.
- **Lifecycle:** soft-delete catalog/coupons; audit append-only; outbox cleanup post-ACK; backups: Atlas continuous + PITR.
