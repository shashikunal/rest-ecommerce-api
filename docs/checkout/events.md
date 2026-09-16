# Checkout — Events

Checkout publishes **no Kafka events** in Phase 15. Rationale, per Phase 5:

- There is no approved `commerce.checkout.events.v1` topic (topics exist for
  user, catalog, inventory, order, payment, notification, search only).
- There is no consumer for checkout transitions in Phase 15 or 16 scope:
  the Order module reads `ready` checkouts directly through the
  `CheckoutCompletionPort` (same monolith — no event hop needed), and
  `order.created` (Phase 16, outbox-backed) is the integration event
  downstream systems consume.
- The inventory transitions inside the saga already emit their own approved
  events (`inventory.reserved/released`) via the inventory outbox.

Adding a topic with zero consumers would violate the "integration events
only where justified" rule. If a future consumer (analytics, notify) needs
checkout signals, the seam is `CheckoutService` emit points + the shared
`outbox_events` collection — no new mechanism required.

Observable today via structured logs: `checkout.created`,
`checkout.validation_started/failed`, `checkout.price_changed` (via
validation issues), `checkout.inventory_reserved/failed`,
`checkout.ready_for_order`, `checkout.cancelled`, `checkout.expired`,
`checkout.completed`, `checkout.concurrency_conflict`,
`checkout.idempotency_replay`, `checkout.compensation_release_failed`.
