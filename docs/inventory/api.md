# Inventory — API

Auth: `Bearer` access token except `GET /inventory/availability` (public).
Standard envelope `{success, data, correlationId}`.
`Idempotency-Key` header honored on init/adjust (Redis replay, like cart).

## `GET /api/v1/inventory/availability?sku=SKU-001` → 200 (public)

```json
{ "sku": "SKU-001", "available": true, "status": "IN_STOCK" }
```

Safe subset only — no quantities, no warehouse internals. Unknown SKU → 404.

## `GET /api/v1/inventory?sku=&status=&limit=&cursor=` → 200 (staff/admin)

Full records `{id, sku, productId, variantId, onHand, reserved, sold,
available, lowStockThreshold, status, version, ...}` with cursor pagination
over SKU order. Note: `status` filters the returned page (status derives from
live quantities, so it cannot be a storage predicate); use `sku` for exact
queries.

## `POST /api/v1/inventory` → 201 / 200 existing

`{sku | productId+variantId, initialOnHand?, lowStockThreshold?}`.
Variant must exist in the catalog. Quantity-setting fields (`onHand`,
`reserved`, `sold`, `available`, `version`, `status`) are rejected.

## `POST /api/v1/inventory/adjust` → 200

`{sku|inventoryId, delta ≠ 0 (|delta| ≤ 1 000 000), reason, referenceType?,
referenceId?, idempotencyKey?}` — never a direct quantity set.
Guard failure (would breach `onHand ≥ reserved`) → 422.
Same `idempotencyKey` replays the current record without re-applying.

## `GET /api/v1/inventory/:id` · `GET /api/v1/inventory/:id/movements`

By id or SKU; ledger is cursor-paginated `(createdAt DESC, _id DESC)`.

## Reservations

`POST /api/v1/inventory/reservations` (`idempotencyKey` required) → 201
`{reservation, inventory}`; oversell → 409 `INSUFFICIENT_STOCK`;
key reuse with different payload → 409 `IDEMPOTENCY_CONFLICT`.
`GET /:id` → 200. `POST /:id/release` → 200 (terminal states replay).
`POST /:id/confirm` → 200 (released/expired → 404, cannot be confirmed).
`POST /api/v1/inventory/reservations/expire-sweep` (ADMIN/SYSTEM) → 200
`{scanned, expired, failed}`.

Checkout integration (Phase 15): call `InventoryService.reserve/release/
confirm/expireReservations` directly — no REST hop, no auth translation
beyond the `InventoryActor` argument.
