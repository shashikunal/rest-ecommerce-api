# Search Boundary

Phase 11 does NOT run a search engine. Atlas `$text(title, description)` backs
`?search=`; `{categoryId, minPrice}` + `_id` tiebreak backs filtered browsing.
The catalog never imports a search client.

Derived-index path (Phase 12+): catalog writes append enveloped events
(`catalog.product*/variant*`, `search.indexRequested/Updated/Removed`) to
`outbox_events`; an external worker publishes them to
`commerce.catalog.events.v1` / `commerce.search.events.v1`; the search indexer
upserts by `(aggregateId, eventVersion)` — idempotent, replayable, order-safe
per product key. Full reindex = replay to a fresh consumer group.
