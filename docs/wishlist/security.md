# Wishlist — Security

Same posture as cart: owner derived from auth context, `userId` rejected in
bodies, all access scoped by `{userId}`, foreign `itemId` → 404, strict zod
schemas, 60/min per-user limit on `/api/v1/wishlist*`, no catalog fields
accepted from the client. `GET /wishlist/check` requires `productId` UUID and
only answers for the caller's own list (no cross-user enumeration).
