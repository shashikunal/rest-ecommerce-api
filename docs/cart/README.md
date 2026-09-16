# Cart Module — README

Authenticated shopping cart. Source of truth: MongoDB (`carts` collection).
One active cart per user (`userId` unique). Guest carts: NOT IMPLEMENTED
(no Phase 0/6 approval; see `architecture.md`).

Base path: `/api/v1/cart` (auth required, 60 req/min/user).

| Method   | Path                  | Notes                                                       |
| -------- | --------------------- | ----------------------------------------------------------- |
| `GET`    | `/cart`               | Cart view with display snapshots + stale/unavailable flags  |
| `POST`   | `/cart/items`         | `{sku,qty}` or `{productId,variantId,quantity}`; dup merges |
| `PATCH`  | `/cart/items/:itemId` | `{quantity,expectedVersion}`; stale → 409                   |
| `DELETE` | `/cart/items/:itemId` | Removes line (404-safe ownership)                           |
| `DELETE` | `/cart`               | Empties items, preserves identity                           |

Price rule: cart holds a **display snapshot**, never the final price.
Checkout (Phase 15) revalidates against the catalog.

See: `architecture.md`, `domain-model.md`, `api.md`, `data-model.md`,
`concurrency.md`, `security.md`, `events.md`, `failure-handling.md`,
`testing.md`, `interview-preparation.md`.
