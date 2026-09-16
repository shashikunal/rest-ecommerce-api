# Checkout — Outbox

Checkout writes nothing to the outbox in Phase 15 (see `events.md` — no
checkout integration events exist yet). The existing outbox implementation
is deliberately **reused by reference, not duplicated**: when Phase 16+
needs checkout-originated events, they go to the same `outbox_events`
collection via the same `OutboxModel`, following the inventory publisher
pattern.

What Phase 16 inherits:

- `CheckoutCompletionPort.complete({checkoutId, orderId})` — version-guarded
  `ready → completed` with `orderId` recorded, so order creation and
  checkout completion stay consistent without a distributed transaction.
- `getForOrder(checkoutId)` — returns the `ready`, unexpired checkout view
  (items, pricing, addresses, customer, reservations) for order snapshotting.
- `expiresAt` + reservation TTL alignment guarantees a `ready` checkout's
  stock is still held when the order module reads it (and order creation
  revalidates anyway).

Event ordering/replay/DLQ for checkout-adjacent signals are therefore the
inventory/order topic guarantees, not new ones: per-SKU ordering on
`commerce.inventory.events.v1`, per-order ordering on
`commerce.order.events.v1` (Phase 16).
