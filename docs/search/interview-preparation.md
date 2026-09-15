# Senior Backend & Solution Architect Interview Preparation

This document contains 30 interview-ready questions and deep technical answers demonstrating senior-level mastery of search systems, distributed architectures, database internals, and high-scale e-commerce platform engineering.

---

### 1. Why should search be separated from the source-of-truth database?
**Answer**:
Transactional databases (like PostgreSQL or MongoDB with replica sets) are optimized for ACID consistency, row/document level locks, high write concurrency, and normalization to prevent anomaly states. Search workloads, conversely, require inverted indexes, tokenization, fuzzy matching, dynamic faceting, and multi-dimensional aggregations over denormalized documents.
Coupling heavy analytical search queries directly to the transactional master leads to CPU spikes, cache thrashing (evicting working set pages from memory), and connection pool starvation that directly degrades transactional checkout and order processing. Decoupling search as a read-optimized projection allows independent scaling, specialized storage engines (e.g. OpenSearch), and zero impact on business-critical writes.

---

### 2. MongoDB search vs Elasticsearch / OpenSearch: what are the key differences?
**Answer**:
- **MongoDB**: Offers basic text search (`$text` indexes based on Lucene, or Atlas Search with Lucene integration). Excellent for single-database operational simplicity in low-to-medium scale systems (< 100k products). However, complex boolean scoring, multi-field cross-boosting, custom token analyzers, and distributed faceting across millions of records are expensive and constrained by MongoDB's execution engine.
- **OpenSearch / Elasticsearch**: Built from the ground up as a distributed inverted index search engine. Provides BM25 probabilistic relevance ranking, custom analyzer pipelines (n-gram, shingle, phonetic, stemmers), aggregations on column-oriented doc values, distributed sharding, and dedicated search node memory pools. It scales horizontally to hundreds of millions of documents with sub-second complex queries.

---

### 3. When would you introduce a dedicated search engine in an e-commerce platform?
**Answer**:
You introduce a dedicated search engine when:
1. **Scale**: Catalog exceeds 200,000–500,000 SKUs or query volume exceeds thousands of QPS.
2. **Relevance Requirements**: Business requires advanced tuning like typo tolerance, field-level boosting (e.g. title boost 5x over description), synonym expansion, semantic search, and merchandising overrides.
3. **Faceted Navigation**: Complex aggregations (e.g. dynamic category, brand, attribute, and price bucketing counts) begin causing database performance degradation.
4. **Decoupling Needs**: Search query spikes (e.g. Black Friday marketing pushes) must not risk knocking down the checkout database.

---

### 4. How does search indexing work asynchronously using the transactional outbox pattern?
**Answer**:
When an entity mutation occurs in the catalog:
1. Within a single ACID transaction, the product changes are committed to the `products` table and an event envelope is appended to the `outbox` table.
2. An outbox relay (e.g. Debezium CDC reading MongoDB Change Streams or a low-latency poller) publishes the event to Kafka (`commerce.search.events.v1`).
3. An indexing consumer service consumes events from Kafka, builds the denormalized `SearchProductDocument`, and upserts it into the search index.
This guarantees **At-Least-Once Delivery** without two-phase commits (2PC) between MongoDB and Kafka.

---

### 5. What is eventual consistency in search, and how do you handle it in e-commerce?
**Answer**:
Eventual consistency means that after a catalog update, the search read model will converge to the new state within a bounded replication window (typically 100ms–2s), rather than instantaneously.
In e-commerce, this is completely acceptable for catalog discovery (a customer seeing a price change 1 second later is harmless). However, at critical transaction boundaries (adding to cart, checkout, payment authorization), the application always validates against the authoritative source of truth (MongoDB/PostgreSQL master) to prevent purchasing at stale prices or out-of-stock items.

---

### 6. How do you rebuild or reindex a search index from scratch?
**Answer**:
1. Create a new target index version (e.g., `catalog-products-v2`) with updated schemas/analyzers.
2. Run a distributed batch backfill worker that cursors through the authoritative database (MongoDB) and bulk-indexes all active products into `v2`.
3. Concurrently replay or dual-write real-time mutation events into both `v1` and `v2`.
4. Run automated data-parity and validation checks (document counts, checksums, spot checks).
5. Atomically update the search alias (`catalog-search`) to point from `v1` to `v2`.
6. Monitor traffic, then drain and delete `v1`.

---

### 7. How do you handle duplicate events in search consumers?
**Answer**:
Search consumers must be **idempotent**. Since Kafka provides at-least-once delivery, duplicates can occur on network timeouts or partition rebalances.
To handle this:
- Upsert operations use deterministic document IDs (`productId`).
- Re-indexing the same document payload produces the exact same search state.
- Alternatively, include an event version or entity timestamp; if `event.version <= currentIndexedVersion`, the consumer safely drops the duplicate.

---

### 8. How do you handle out-of-order events?
**Answer**:
Network retries or multi-partition concurrency can cause Event v5 (status = archived) to arrive before Event v4 (status = active).
We prevent state regression by embedding an incremental entity version or timestamp in every event. The search projection stores the latest `indexed_version`. When processing an event:
- If `event.version > current.version`: apply update and store new version.
- If `event.version <= current.version`: discard the update as stale.

---

### 9. How do you prevent stale search results from polluting the user experience?
**Answer**:
1. **Targeted Cache Invalidation**: Catalog mutation events immediately emit cache eviction commands (`search:*`, `suggest:*`) in Redis.
2. **Short TTLs**: Enforce a conservative 60-second TTL on public search queries.
3. **Client Refresh**: Support ETag / If-None-Match headers so clients can invalidate browser-level cached search results.
4. **Soft-delete filtering**: Search consumers immediately issue deletes/tombstones when a product status transitions to unpublish or archived.

---

### 10. How do you design cursor pagination for search?
**Answer**:
Cursor pagination encodes the position of the last item on the current page based on the active sort criteria:
- Payload: `{ sort: 'price_asc', sortValue: 9900, productId: 'prod-123', issuedAt: 1789489100 }`.
- Opaque Token: Encoded in Base64URL and cryptographically signed with HMAC-SHA256.
- Database Query: `WHERE (price > :sortValue) OR (price = :sortValue AND id > :productId) ORDER BY price ASC, id ASC LIMIT :limit`.

---

### 11. Offset pagination vs cursor pagination: why does cursor win?
**Answer**:
- **Offset (`skip=100000, limit=20`)**:
  - Requires the database engine to traverse 100,000 records before returning 20 ($O(N)$ computational complexity).
  - Susceptible to **page drift**: items added or deleted shift indices, resulting in duplicate or skipped records across pages.
- **Cursor (`seek-based`)**:
  - Uses index seeks on sorted fields ($O(\log N)$ computational complexity).
  - Immune to page drift because navigation is anchored to the exact value and unique ID of the boundary record.

---

### 12. Why is stable sorting critical in distributed pagination?
**Answer**:
When sorting by non-unique fields (e.g. price, publication date), multiple records have identical values. Without an explicit tie-breaker, the relational database or search engine does not guarantee deterministic order across separate queries or replica nodes. This causes records to flip-flop between pages.
Appending an immutable, unique field (like `product.id`) as the secondary sort criteria guarantees 100% deterministic, stable ordering.

---

### 13. How do you design faceted search at scale?
**Answer**:
Faceted search computes aggregation counts for categories, brands, price ranges, and attributes based on the current search filter context.
At scale:
1. **Search Engine Doc Values**: In OpenSearch/Elasticsearch, use column-oriented doc values to compute aggregations in memory without loading source JSON.
2. **Post-Filters**: Apply general search query for facets, then use post-filters so selecting a brand does not collapse the counts of competing brands.
3. **Approximate Aggregations**: Use algorithms like HyperLogLog++ for cardinality counting to bound memory usage.

---

### 14. How do you cache search results effectively?
**Answer**:
1. **Query Normalization**: Clean whitespace, lowercase terms, and sort filter parameters so semantically identical queries yield the exact same cache key hash.
2. **Key Namespacing**: `search:v1:{sha256(normalizedQuery)}`.
3. **Fail-Open Strategy**: If Redis is down, bypass caching and query the search provider directly; never fail a user search due to a cache outage.

---

### 15. How do you invalidate search cache without enumerating millions of keys?
**Answer**:
Because search queries have high parameter permutations, scanning and invalidating every possible combination is computationally prohibitive ($O(N)$ Redis keys).
Best practices:
1. **Short TTL**: Use 30–60 second TTLs so stale entries expire rapidly on their own.
2. **Key Prefix Invalidation**: Invalidate `search:*` using Redis `SCAN` + `UNLINK` in non-blocking background threads, or maintain versioned cache namespaces (`search:v{version}:...`).

---

### 16. How do you prevent cache stampede (thundering herd) on popular searches?
**Answer**:
When a popular cache key (e.g. search for `"iphone"`) expires:
1. **Probabilistic Early Expiration (XFetch Algorithm)**: Recompute the cache asynchronously before it actually expires based on remaining TTL and computation time.
2. **Distributed Mutex / Singleflight**: Ensure only one worker recomputes the cache on a miss, while concurrent requests either wait or return the slightly stale cached value.

---

### 17. How do you protect search from bots and scraping?
**Answer**:
1. **Multi-Tier Rate Limiting**: Enforce IP, user, and API-key rate limits (e.g., 60 req/min for search, 120 req/min for suggestions) returning HTTP 429 with `Retry-After`.
2. **WAF & Bot Management**: Use Cloudflare / AWS WAF with CAPTCHA challenges on anomalous traffic patterns.
3. **Deep Paging Bounds**: Block pagination beyond a reasonable human depth (e.g. max 50 pages).

---

### 18. How do you prevent expensive or pathological search queries?
**Answer**:
1. **Query Length Clamping**: Limit query text to max 100 characters.
2. **Filter Whitelisting**: Reject unknown query operators or arbitrary nested objects.
3. **Bounded Page Size**: Enforce strict `limit` bounds (e.g. 1–50).
4. **Execution Timeouts**: Impose strict 2-second database statement timeouts.

---

### 19. How do you handle zero-result searches?
**Answer**:
1. **User Experience**: Return an empty item array with status 200, accompanied by popular recommendations or category suggestions.
2. **Zero-Result Telemetry**: Log zero-result queries to analytics to identify missing catalog items, common typos, or merchandising gaps.
3. **Fallback Strategies**: Implement automated typo correction (Levenshtein distance / fuzzy matching) or query relaxation (drop least significant tokens).

---

### 20. How do you improve search relevance in e-commerce?
**Answer**:
1. **Field Boosting**: Boost Title (5x), Brand (3x), Category (2x) over broad product descriptions.
2. **Commercial Signals**: Factor popularity, sales velocity, conversion rate, and customer ratings into the final relevance score.
3. **Synonym Dictionaries**: Map common terms (e.g. `"sneakers"` -> `"shoes"`).
4. **N-Gram Tokenizers**: Enable partial matching for model numbers and technical serials.

---

### 21. How would autocomplete / search suggestions scale to 100,000 QPS?
**Answer**:
1. **Edge Caching**: Autocomplete suggestions are public; serve them directly from Cloudflare / CloudFront CDN edge locations with short TTLs (60s).
2. **In-Memory Trie / Redis Prefix Trees**: Use Redis sorted sets (`ZREVRANGEBYLEX`) or in-memory trie structures to deliver prefix matches in < 5ms.
3. **Dedicated Autosuggest Clusters**: Separate autocomplete infrastructure from full search clusters so typing keystrokes never compete with heavy search requests.

---

### 22. How would you handle a catalog with 100 million products?
**Answer**:
1. **Sharding**: Shard the OpenSearch index across multiple data nodes using `category_id` or `merchant_id` routing keys.
2. **Read/Write Splitting**: Route search queries to dedicated read replicas; route ingestion to ingestion nodes.
3. **Index Lifecycle Management (ILM)**: Segment catalog into hot (frequently searched active products) and warm/cold (rarely accessed long-tail or archived products) tiers.

---

### 23. How do you shard and index millions of variant SKUs efficiently?
**Answer**:
Do not create 100 million flat documents if variants share 95% of product data.
- Use **Nested Documents** or **Parent/Child Join mappings**: Store the parent product once, with variants nested inside.
- Alternatively, denormalize only necessary variant attributes (e.g., array of available colors and sizes) onto the parent document, avoiding explosive index growth.

---

### 24. How do you perform zero-downtime search reindexing in production?
**Answer**:
1. Leverage **Index Aliases** in OpenSearch: Application queries alias `catalog-search`.
2. Build new index `catalog-search-20260915`.
3. Backfill data and stream change events to both indexes.
4. Execute atomic alias switch: remove alias from old index and add to new index in one atomic call.
5. Zero packet drops or client errors.

---

### 25. How do you handle search engine outages gracefully?
**Answer**:
1. **Graceful Degradation**: Catch search cluster connection timeouts.
2. **Read-Through Fallback**: If approved, fall back to basic database queries with restricted filter options and strict rate limits to prevent overloading the primary DB.
3. **Circuit Breakers**: Use Netflix Hystrix / Cockatiel circuit breakers to fast-fail traffic when the search cluster is unhealthy rather than saturating application server threads.

---

### 26. Why should inventory not be tightly coupled to search?
**Answer**:
Inventory levels fluctuate continuously (thousands of reservations and releases per second during flash sales). If every single inventory increment triggered a search index update:
- Search indexing queues would choke with near-infinite churn.
- Cache invalidation would defeat search caching completely.
Instead, search indexes general availability (`IN_STOCK` vs `OUT_OF_STOCK` flags updated periodically or via high-watermark events), while real-time inventory validation occurs exclusively at cart and checkout boundaries.

---

### 27. How do you handle product updates occurring while a background reindexing job is running?
**Answer**:
Use **Dual-Writing / Event Replay with Timestamps**:
1. Start backfill at timestamp $T_1$.
2. All real-time update events occurring after $T_1$ are written to both the old index and the new index.
3. The new index uses optimistic concurrency control (`version` or `updatedAt`). If a backfill worker attempts to write a record with an older version than an event that already updated it, the older write is rejected.

---

### 28. Why is frontend debouncing insufficient for backend protection?
**Answer**:
Frontend debouncing (e.g. waiting 300ms after a keystroke before firing an HTTP call) is purely a client-side optimization for legitimate browser users. It offers zero security against:
- Malicious botnets and scrapers that bypass the UI and call REST APIs directly.
- Multi-tab browser users.
- Fast programmatic API consumers.
The backend must always enforce its own server-side token-bucket rate limiting and validation.

---

### 29. How does search scale independently from transactional APIs?
**Answer**:
By deploying search on separate container services / serverless instances with dedicated horizontal pod autoscaling (HPA) triggered by search QPS or CPU.
Search read replicas can scale out dynamically during high-traffic browsing events without provisioning extra expensive master database instances.

---

### 30. When would you use MongoDB Atlas Search versus a dedicated OpenSearch cluster?
**Answer**:
- **MongoDB Atlas Search**:
  - Embedded Lucene running on MongoDB nodes.
  - Zero outbox/Kafka pipeline required; automatic sync.
  - Ideal for engineering teams wanting operational simplicity without managing separate Kafka pipelines, index lifecycle scripts, and second clusters for moderate catalogs (< 500k documents).
- **Dedicated OpenSearch / Elasticsearch**:
  - Independent compute and memory scaling from MongoDB.
  - Advanced cluster topologies, cross-cluster replication, and specialized search plugins.
  - Essential for multi-tenant enterprise e-commerce platforms processing millions of SKUs and tens of thousands of search queries per second.
