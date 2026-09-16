# Cart — Failure Handling

| Scenario                        | Behavior                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Add valid item                  | 201 (new) / 200 (merged)                                                                                  |
| Add duplicate                   | Quantity merged, capped 50                                                                                |
| Unknown/inactive SKU            | 422 `UNPROCESSABLE`                                                                                       |
| Bad quantity                    | 400 `VALIDATION_ERROR`                                                                                    |
| Qty overflow on merge           | Increment rolled back, 422                                                                                |
| Concurrent update               | 409 `CONCURRENT_UPDATE` + re-readable view                                                                |
| Retry with same Idempotency-Key | Original response replayed                                                                                |
| Same key, different body        | 409 `IDEMPOTENCY_CONFLICT`                                                                                |
| Foreign itemId                  | 404 (no oracle)                                                                                           |
| Rate limit exceeded             | 429 + `Retry-After`                                                                                       |
| Redis down                      | Idempotency/rate-limit degrade per existing policy (warn + continue; fail-closed only on auth/pay scopes) |
| MongoDB down                    | 503 via global handler; no partial writes (single-doc atomic ops)                                         |
| Catalog price changed           | Snapshot kept, `priceStale: true` surfaced                                                                |
| Cart expired (30d)              | TTL removes doc; next write reactivates a fresh cart                                                      |
