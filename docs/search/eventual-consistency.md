# Eventual Consistency & Replication Lag

## 1. Tradeoffs: Strong vs Eventual Consistency
- **Catalog Master (MongoDB)**: Requires strong read-your-writes consistency for admin merchants updating inventory, titles, and variant options.
- **Search (Projection)**: Serves massive public read traffic. Attempting distributed two-phase commits across MongoDB, OpenSearch, and Redis would cripple system availability and latency. Therefore, search is **eventually consistent**.

---

## 2. Bounded Staleness
Replication lag is bounded to sub-second windows in normal operations:
1. Master write committed in MongoDB + outbox record inserted (< 20ms).
2. Outbox relay polls and sends to Kafka (< 100ms).
3. Indexing consumer pulls batch and updates projection (< 200ms).
4. Redis cache TTL (60s) or active mutation invalidation ensures fresh results.

---

## 3. Handling Out-of-Order Events
If Kafka partition rebalancing or network retries causes event version 5 to arrive before version 4:
```text
Event v5 (Price = $899)  --> Applied to index (Recorded indexed_version = 5)
Event v4 (Price = $999)  --> Arrives later
                             Check: event.version (4) <= indexed_version (5)
                             Result: Dropped as stale. Index does not regress.
```
