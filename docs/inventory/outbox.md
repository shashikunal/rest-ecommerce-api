# Inventory — Outbox (and Inbox)

## Outbox: reused, not duplicated

Inventory writes to the existing `outbox_events` collection through the
existing `OutboxModel` (same schema, same `uq_event` / `ix_status_created`
indexes, same `PENDING → CLAIMED → SENT` lifecycle owned by the Phase 25
publisher). `OutboxInventoryEventPublisher` differs from the catalog
publisher only in topic (`commerce.inventory.events.v1`) and producer tag —
no second collection, no second claim/mark mechanism was created.

```text
reserve/release/confirm/adjust
  → MongoDB (stock + reservation + movement)
  → outbox_events PENDING (non-blocking; warn-and-continue on failure)
  → (Phase 25 publisher) → Kafka → order-guard / audit / analytics / notify-ops
```

Failure posture (matches catalog): the business write never rolls back for
an outbox failure; `eventId` uniqueness dedupes publisher retries; consumers
treat delivery as at-least-once.

## Inbox: none exists — natural-key dedupe instead

No inbox collection or consumer runtime exists in the codebase yet, so the
only inventory consumer path (the approved `catalog.variantCreated →
inventory-bootstrap` edge) is shipped as a pure, tested handler
(`VariantBootstrapHandler`) that Phase 25 can invoke. Duplicate/replayed
variant events converge on the unique-SKU upsert (`create` duplicate →
re-read → `{bootstrapped: false}`), which is the inbox-dedupe equivalent
for this edge. When a shared inbox table lands, this handler is the place
to record `(consumer, eventId)`.
