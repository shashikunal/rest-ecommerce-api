# Wishlist — Data Model (MongoDB `wishlists`)

```text
{ _id: uuid, userId: string (unique), version: number,
  items: [{ itemId, productId, variantId|null, sku (upper), addedAt }] }
```

Indexes:

- `uq_wishlist_user` on `userId` UNIQUE — single doc per user; all access by owner.

Exactly one index: wishlist is always fetched whole by `userId`, then paged
in memory over a bounded (≤200) embedded array — no multikey index needed.
Duplicate safety comes from the conditional `$nor` update filter, not an index.
