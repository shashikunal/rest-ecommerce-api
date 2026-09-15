# Search Events & Outbox Propagation

## 1. Domain Event Triggers

Catalog lifecycle mutations emit events to the transactional outbox destined for `commerce.search.events.v1`:

| Trigger | Event Name | Outbox Topic | Payload Details |
|---|---|---|---|
| Product Created | `search.indexRequested` | `commerce.search.events.v1` | `{ productId }` |
| Product Updated | `search.indexUpdated` | `commerce.search.events.v1` | `{ productId, version }` |
| Product Published | `search.indexUpdated` | `commerce.search.events.v1` | `{ productId }` |
| Product Unpublished | `search.indexRemoved` | `commerce.search.events.v1` | `{ productId }` |
| Product Archived | `search.indexRemoved` | `commerce.search.events.v1` | `{ productId }` |
| Variant Created | `search.indexUpdated` | `commerce.search.events.v1` | `{ productId, variantId }` |
| Variant Updated | `search.indexUpdated` | `commerce.search.events.v1` | `{ productId, variantId }` |

---

## 2. Idempotent Consumer Processing
Search indexing consumers process incoming Kafka messages idempotently:
1. **Deduplication**: Events are keyed by `productId`. Duplicate deliveries within the consumer group result in the same upsert operation.
2. **Version Checks**: The consumer compares `event.version >= currentIndexedVersion`. Stale or out-of-order events are safely discarded.
3. **Status Check**: If `status !== 'published'`, the consumer executes `remove(productId)` to ensure non-public products never linger in search.
