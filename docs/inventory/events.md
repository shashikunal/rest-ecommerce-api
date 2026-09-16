# Inventory — Events

Published integration events (topic `commerce.inventory.events.v1`, key = SKU,
per approved `event-catalog.md` + `topic-design.md`):

| Event                 | Producer op                                      | Approved consumer      |
| --------------------- | ------------------------------------------------ | ---------------------- |
| `inventory.adjusted`  | every adjustment (carries before/after + status) | audit                  |
| `inventory.reserved`  | successful reserve                               | order-guard, analytics |
| `inventory.released`  | release or expiry (`reason` distinguishes)       | order, analytics       |
| `inventory.committed` | confirm (reserved → sold)                        | order, analytics       |
| `inventory.lowStock`  | downward crossing into `LOW_STOCK` only          | notify-ops             |

Deliberately not published: bootstrap `INIT` (no consumer), restock
transitions (consumers derive from `adjusted`), per-read availability
(request-scoped, no consumer — same rationale that dropped `CartCreated`).

Envelope = the canonical Phase 5 shape (`eventId`, `eventType`,
`eventVersion`, `occurredAt`, `producer: inventory-svc`, `aggregateType`
`inventory | reservation`, `aggregateId` = SKU or reservation id,
`correlationId`, `causationId` = reservation id for release/commit chains,
`schemaVersion`, `payload`). No competing format was introduced.
