# Wishlist — Domain Model

`Wishlist { id, userId, items[], version, createdAt, updatedAt }`

`WishlistItem { itemId, productId, variantId|null, sku, addedAt }` persisted;
`title/imageUrl/unitMinor/currency/state` enriched on read from the catalog.

Uniqueness: `(productId, variantId)` when a variant is known, else
`(productId, sku)`. Max 200 items per user.

Read states (reference retained, list never breaks):

- `AVAILABLE` — product published AND variant active.
- `UNAVAILABLE` — archived/unpublished product or discontinued variant.
- `REMOVED` — referenced product/variant no longer exists.
