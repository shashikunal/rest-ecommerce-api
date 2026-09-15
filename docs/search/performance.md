# Search Performance & Backpressure

## 1. Latency Targets & Budgets

| Metric | Cache Hit Target | Cache Miss Target | Worst-Case Bound |
|---|---|---|---|
| p50 | < 15ms | < 80ms | < 120ms |
| p95 | < 30ms | < 250ms | < 350ms |
| p99 | < 50ms | < 500ms | < 700ms |

---

## 2. Database & Index Optimizations
1. **Compound Filtering Indexes**:
   - `{ status: 1, categoryId: 1, minPriceMinor: 1 }`
   - `{ status: 1, brandId: 1, minPriceMinor: 1 }`
   - `{ status: 1, createdAt: -1 }`
2. **Projections**: Never execute `SELECT *` / unprojected queries. Only fetch fields needed to construct `SearchProductDocument`.
3. **No Regex Full Collection Scans**: Reject queries attempting unanchored wildcard patterns (`.*foo.*`) across millions of records.
4. **Bounded Result Sets**: Strict maximum limit of 50 items per query prevents database memory exhaustion.

---

## 3. Backpressure & Timeout Strategy
- **Search Query Timeout**: Database searches enforce bounded timeouts (max 2500ms).
- **Graceful Error Handling**: Requests taking longer than the SLA fail fast with standardized error payloads rather than holding Node.js event-loop resources.
- **Client Cache-Control**: Edge CDNs cache search responses for 60 seconds, absorbing massive traffic spikes during marketing campaigns.
