# Cart — API

Auth: `Bearer` access token. Standard envelope `{success,data,correlationId}`.
`Idempotency-Key` (8–128 chars) honored on POST/PATCH/DELETE when supplied.

## `GET /api/v1/cart` → 200

```json
{
  "id": "...",
  "status": "active",
  "items": [
    {
      "itemId": "...",
      "sku": "SKU-001",
      "variantId": "...",
      "productId": "...",
      "title": "...",
      "quantity": 2,
      "unitMinor": 1999,
      "currency": "USD",
      "lineTotalMinor": 3998,
      "priceStale": false,
      "unavailable": false
    }
  ],
  "itemCount": 2,
  "subtotalMinor": 3998,
  "currency": "USD",
  "version": 3,
  "hasStalePrices": false,
  "hasUnavailableItems": false
}
```

## `POST /api/v1/cart/items` → 201 (new) / 200 (merged)

Accepts `{sku, qty|quantity}` (Phase 6) or `{productId, variantId|skuId,
quantity}`. `price/currency/title/userId/ownerId` are rejected (strict schema).
Errors: 400 validation · 422 unavailable/unknown SKU · 409 stale expectedVersion.

## `PATCH /api/v1/cart/items/:itemId` → 200

`{qty|quantity, expectedVersion}` (required). Stale version → 409
`CONCURRENT_UPDATE`; missing line → 404.

## `DELETE /api/v1/cart/items/:itemId` → 200 · `DELETE /api/v1/cart` → 200

Remove returns the updated view; clear preserves cart identity.
`?version=` optimistic guard supported on remove.

Frontend contract: render `priceStale` as "price changed" banner (old snapshot
kept), `unavailable` as disabled line, 409 as "cart changed — refreshed"
using the returned view; merge-on-login is future (no guest carts yet).
"Move wishlist → cart" = wishlist read + cart add (no dedicated endpoint).
