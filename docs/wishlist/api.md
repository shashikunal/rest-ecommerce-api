# Wishlist — API

## `GET /api/v1/wishlist?limit=20&cursor=` → 200

```json
{
  "items": [
    {
      "itemId": "...",
      "productId": "...",
      "variantId": "...",
      "sku": "SKU-001",
      "title": "...",
      "state": "AVAILABLE"
    }
  ],
  "pagination": { "limit": 20, "nextCursor": "...", "hasMore": false },
  "version": 2
}
```

## `POST /api/v1/wishlist/items` → 201 / 200 (duplicate, same body)

`{sku}` or `{productId, variantId?}`. Unknown product → 404.

## `DELETE /api/v1/wishlist/items/:itemId` → 204 (404 if not owner)

## `GET /api/v1/wishlist/check?productId=&variantId=` → 200 `{saved,itemId}`
