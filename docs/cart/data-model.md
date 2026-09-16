# Cart — Data Model (MongoDB `carts`)

```text
{ _id: uuid, userId: string (unique), status: active|converted|expired,
  version: number, lastActivityAt: Date, expiresAt: Date (TTL 30d),
  items: [{ itemId, sku (upper), variantId, productId, title, variantLabel?,
            imageUrl?, quantity 1..50, unitMinor, currency, addedAt, updatedAt }] }
```

Indexes:

- `uq_cart_user` on `userId` UNIQUE — one cart per user; lookup path.
- `ix_cart_status_activity` on `(status, lastActivityAt)` — expiry/abandoned scans.
- `ttl_cart_expiry` on `expiresAt` (`expireAfterSeconds: 0`) — 30d retention.

No multikey index on `items.*` (embedded lines are always read with the parent).
No catalog data duplication beyond the minimal display snapshot.
