# Catalog Events

Envelope (per `docs/architecture/events/event-envelope.md`):
`{eventId, eventType, eventVersion: 1, occurredAt, producer: 'catalog-svc',
aggregateType, aggregateId (= Kafka partition key), correlationId,
causationId, schemaVersion, payload}`. Payloads carry ids + minimal business
data + versions — never full docs, media bytes, or secrets.

Emitted: `catalog.productCreated/Updated/Published/Unpublished`,
`catalog.variantCreated/Updated`, `search.indexRequested/Updated/Removed`.
No `ProductDeleted` (unpublish + archive cover it).

## Outbox

`outbox_events` collection (`uq_event` on `eventId`, `ix_status_created`).
Writes are sequential: state document first, outbox record second
(`OutboxCatalogEventPublisher` routes catalog.* → `commerce.catalog.events.v1`,
search.* → `commerce.search.events.v1`). Replica-set transactions graduate in
Phase 18; until then single-doc atomicity + best-effort outbox append
(non-blocking on failure, logged). Consumers must be idempotent
(upsert by `(aggregateId, eventVersion)`); breaking changes bump
`eventVersion` with dual-publish, never silent resemantics.
