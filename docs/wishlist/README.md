# Wishlist Module — README

Persistent per-user wishlist. Source of truth: MongoDB (`wishlists` collection).
One document per user (`userId` unique), items embedded.

Base path: `/api/v1/wishlist` (auth required, 60 req/min/user).

| Method   | Path                                  | Notes                                                  |
| -------- | ------------------------------------- | ------------------------------------------------------ |
| `GET`    | `/wishlist?limit&cursor`              | Cursor page, graceful item states                      |
| `POST`   | `/wishlist/items`                     | `{sku}` or `{productId,variantId}`; dup → 200 existing |
| `DELETE` | `/wishlist/items/:itemId`             | 204                                                    |
| `GET`    | `/wishlist/check?productId&variantId` | `{saved,itemId}`                                       |

Item states on read: `AVAILABLE` / `UNAVAILABLE` / `REMOVED`
(reference retained, never breaks the list).

See: `architecture.md`, `domain-model.md`, `api.md`, `data-model.md`,
`concurrency.md`, `security.md`, `events.md`, `failure-handling.md`,
`testing.md`, `interview-preparation.md`.
