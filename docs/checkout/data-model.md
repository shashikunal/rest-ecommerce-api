# Checkout — Data Model (MongoDB `checkouts`)

```text
{ _id: uuid, userId, cartId, cartVersion, status,
  items[] {productId, variantId, sku, title, variantLabel?,
           quantity 1..50, unitMinor, currency, lineTotalMinor},
  shippingAddress {...}, billingAddress {...},
  subtotalMinor, discountMinor, shippingMinor, taxMinor, grandTotalMinor,
  currency, couponCode?,
  customerUserId, customerEmail, customerName,
  reservations[] {reservationId, sku, quantity},
  idempotencyKey?, reqHash?, failReason?, orderId?,
  version, expiresAt, createdAt, updatedAt }
```

Indexes and why:

- `uq_checkout_user_idem` on `(userId, idempotencyKey)` UNIQUE SPARSE —
  restart-safe duplicate-create detection (Redis is only the fast path).
- `ix_checkout_user_created` on `(userId, createdAt DESC)` — own-checkout list.
- `ix_checkout_cart` on `(cartId)` — cart-overlap inspection.
- `ix_checkout_status_expiry` on `(status, expiresAt)` — sweep query.

No TTL deletion: expired/cancelled/failed checkouts are retained as the
purchase-attempt audit trail; expiry only transitions state and releases
reservations.
