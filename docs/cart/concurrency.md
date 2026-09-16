# Cart — Concurrency

Optimistic concurrency on `version` + atomic MongoDB operators. No process-local
locks (serverless-safe).

```mermaid
sequenceDiagram
    participant A as Tab A (v10)
    participant B as Tab B (v10)
    participant DB as MongoDB
    A->>DB: update qty WHERE version=10
    DB-->>A: ok → v11
    B->>DB: update qty WHERE version=10
    DB-->>B: no match → 409 CONCURRENT_UPDATE
    B->>DB: GET cart (v11)
    B->>DB: retry WHERE version=11
    DB-->>B: ok → v12
```

- Add duplicate: `items.sku`-matched `$inc` (atomic merge); concurrent first-adds
  for a new SKU race on `'items.sku': {$ne}` + version — loser gets 409 and
  retries into the merge path.
- Remove vs update: both version-guarded; loser re-reads (remove of an already
  removed line → 404).
- Retry-after-timeout: safe via `Idempotency-Key` (Redis replay of stored
  response; same key + different body → 409 `IDEMPOTENCY_CONFLICT`).
- Quantity overflow on merge rolls back the `$inc` and returns 422.
