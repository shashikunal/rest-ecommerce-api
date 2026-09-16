# Inventory — Domain Model

`Inventory { id, sku, productId, variantId, onHand, reserved, sold,
lowStockThreshold, version, createdAt, updatedAt, lastMovementAt }`

Persisted quantities are authoritative; everything else derives:

```text
available = onHand - reserved
status    = available <= 0 ? OUT_OF_STOCK
          : available <= lowStockThreshold ? LOW_STOCK
          : IN_STOCK
```

Invariants (enforced inside every conditional update, never in app memory):

```text
onHand >= 0, reserved >= 0, sold >= 0, reserved <= onHand
```

Phase 4 mapping: the approved `{skuId, available, reserved, sold}` record is
preserved structurally — `available` is derived instead of stored (so it can
never contradict `onHand - reserved`), and `onHand` makes receipts/write-offs
explicit. `onHand + sold` equals cumulative receipts minus write-offs, all
visible in the movement ledger, which is the auditable form of the Phase 4
`available + reserved + sold == totalReceived` invariant.

`Reservation { id, inventoryId, sku, productId, variantId, quantity, status,
referenceType, referenceId, idempotencyKey, expiresAt, version, ... }`
with `status ∈ active | released | expired | confirmed` (Phase 4 names).
Legal transitions: `active → released | expired | confirmed` only; terminal
states never move (repeat calls replay the current state).

`InventoryMovement` is append-only (see `inventory-ledger.md`).
