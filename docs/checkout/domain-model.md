# Checkout — Domain Model

`Checkout { id, userId, cartId, cartVersion, status, items[], shippingAddress,
billingAddress, pricing, currency, customer, reservations[], idempotencyKey,
reqHash, failReason, orderId, version, expiresAt, createdAt, updatedAt }`

- `items[]`: authoritative purchase lines `{productId, variantId, sku, title,
variantLabel, quantity, unitMinor, currency, lineTotalMinor}` — resolved
  from the catalog at creation, never from the client.
- `pricing`: `{subtotalMinor, discountMinor: 0, shippingMinor: 0, taxMinor: 0,
grandTotalMinor, currency, couponCode}` — only subtotal has approved logic
  (see `pricing.md`).
- Addresses: immutable snapshots (see `api.md` — corrigible only via the
  version-guarded address endpoint until completion).
- `reservations[]`: `{reservationId, sku, quantity}` references — quantity
  state lives in Inventory, never duplicated here.
- `customer`: `{userId, email, name}` snapshot from Users at creation.
- `cartVersion`: optimistic anchor — any cart drift fails revalidation
  (`CART_CHANGED`) instead of purchasing stale state.
- `orderId`: set once by Phase 16 via the completion port; null until then.
