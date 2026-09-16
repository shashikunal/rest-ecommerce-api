# Checkout — API

Auth: `Bearer` on all routes. Standard envelope. `CHECKOUT` 10/min policy
applies to the whole `/api/v1/checkout` prefix (pre-existing).

## `POST /api/v1/checkout` → 201 / 200 replay (Idempotency-Key required)

```json
{
  "shippingAddress": {
    "fullName": "...",
    "line1": "...",
    "city": "...",
    "region": "...",
    "postalCode": "...",
    "country": "GB"
  },
  "billingAddress": null,
  "couponCode": null
}
```

Missing key → 400. Same key + same body → 200 replay; different body → 409
`IDEMPOTENCY_CONFLICT`. Client price/totals/cart/user fields are rejected by
the strict schema (400). Empty cart → 422 `CART_EMPTY`; unavailable item →
422 `ITEM_UNAVAILABLE`.

## `GET /api/v1/checkout?limit&cursor` · `GET /api/v1/checkout/:id`

Owner-scoped; foreign ids → 404 (no oracle).

## `POST /api/v1/checkout/:id/validate` → 200 `{checkout, ok, issues[]}` / 422

Dry run (no inventory side effects). Issues: `CART_EMPTY`, `CART_CHANGED`,
`PRICE_CHANGED` (with sku), `ITEM_UNAVAILABLE`. Any issue marks the checkout
`failed` — the client creates a fresh checkout rather than patching money.

## `POST /api/v1/checkout/:id/reserve` → 200 ready

Revalidates, reserves every line (`referenceType: checkout`,
`idempotencyKey: <checkoutId>:<sku>`), compensates partial failure, lands in
`ready`. Oversell → 409 `INSUFFICIENT_STOCK` with checkout marked failed.

## `PATCH /api/v1/checkout/:id/address` → 200

`{shippingAddress, billingAddress?, expectedVersion}` — replaces the address
snapshot in `priced|reserved|ready`; stale version → 409.

## `POST /api/v1/checkout/:id/cancel` → 200

Releases all reservations (idempotent) → `cancelled`. Repeat → 200 replay.

## `POST /api/v1/checkout/expire-sweep` → 200 (ADMIN/SYSTEM)

`{scanned, expired, failed}` — the Phase 25 worker boundary.

Frontend contract: drive the UX steps (review → address → review → pay) off
`status`; on 409 `PRICE_CHANGED`/`CART_CHANGED` show old→new and restart from
a fresh `POST /checkout`; never cache money states (`private, no-store`
applies); poll `GET /:id`, never blind re-POST without the same key.
