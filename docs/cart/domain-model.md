# Cart — Domain Model

`Cart { id, userId, status, items[], version, createdAt, updatedAt, lastActivityAt }`

Line identity: normalized `SKU` (uppercase, trimmed). `productId + variantId`
are resolved server-side and stored as references, never trusted from input.

`CartItem { itemId, sku, variantId, productId, title, variantLabel, imageUrl,
quantity, price{unitMinor,currency}, addedAt, updatedAt }`
Snapshots are display-only (`title`, first media image, unit price at add time).

Rules:

- Quantity: integer, 1–50 (reject 0/negative/decimals/NaN/Infinity; no float math —
  money stays in integer minor units).
- Max 50 lines per cart (`items.50 $exists` guard).
- Duplicate add merges: `existing + requested`, capped at 50 (overflow rolls back
  the increment and returns 422).
- Transitions: `active→converted|expired`, `expired→active`; `converted` terminal.
- `clear` empties `items`, bumps `version`, preserves `_id`/`userId`.
