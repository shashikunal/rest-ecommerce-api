# Inventory — Data Model

## `inventories`

```text
{ _id: uuid, sku (upper, unique), productId, variantId,
  onHand ≥ 0, reserved ≥ 0, sold ≥ 0, lowStockThreshold ≥ 0,
  version, lastMovementAt, createdAt, updatedAt }
```

Indexes:

- `uq_inventory_sku` on `sku` UNIQUE — identity + idempotent bootstrap + lookup path.
- `ix_inventory_product_variant` on `(productId, variantId)` — variant linkage queries.

## `inventory_reservations`

```text
{ _id: uuid, inventoryId, sku, productId, variantId, quantity ≥ 1,
  status active|released|expired|confirmed, referenceType, referenceId,
  idemKey (sparse unique), expiresAt, version, createdAt, updatedAt }
```

Indexes:

- `uq_reservation_idem` on `idemKey` UNIQUE SPARSE — cross-retry dedupe.
- `ix_reservation_sku_status` on `(sku, status)` — per-SKU active-reservation scans.
- `ix_reservation_status_expiry` on `(status, expiresAt)` — sweep query.
- `ix_reservation_reference` on `(referenceType, referenceId)` — Phase 16 order linkage.

No TTL deletion: expired reservations are retained as audit history; the sweep
only transitions state (a TTL index would destroy the ledger trail).

## `inventory_movements` (append-only)

```text
{ _id: uuid, inventoryId, sku, type INIT|ADJUST|RESERVE|RELEASE|EXPIRE|CONFIRM,
  quantityDelta, previousOnHand, previousReserved, newOnHand, newReserved,
  reason, referenceType?, referenceId?, actorType, actorId,
  idempotencyKey (sparse unique), correlationId, createdAt }
```

Indexes:

- `ix_movement_inventory_created` on `(inventoryId, createdAt DESC)` — ledger reads.
- `uq_movement_idem` on `idempotencyKey` UNIQUE SPARSE — replay convergence.

No updates or deletes are issued against this collection by application code.
