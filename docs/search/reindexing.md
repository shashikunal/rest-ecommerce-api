# Zero-Downtime Reindexing & Blue/Green Migration

## 1. When Reindexing is Necessary
A full catalog reindex is required when:
- Updating search analyzer tokenization (e.g. changing n-gram settings, stemmers, or language filters).
- Adding or remapping indexed attributes.
- Tuning BM25 relevance parameters.
- Migrating from MongoDB search provider to OpenSearch cluster.

---

## 2. Zero-Downtime Blue/Green Reindexing Flow

```mermaid
flowchart TD
  Start[Initiate Reindexing]-->CreateNew[1. Create New Index: catalog-products-v2]
  CreateNew-->Backfill[2. Batch Read Published Catalog from MongoDB]
  Backfill-->DualWrite[3. Replay Events or Dual-Write to v1 & v2]
  DualWrite-->Verify[4. Parity & Health Verification on v2]
  Verify-->SwitchAlias[5. Atomic Alias Switch: catalog-search -> catalog-products-v2]
  SwitchAlias-->Retire[6. Drain & Retire Old Index: catalog-products-v1]
```

### Key Safety Guarantees
1. **Source of Truth Untouched**: The reindexing process performs read-only cursor scans on MongoDB master/secondaries. Catalog data cannot be corrupted.
2. **Atomic Alias Flip**: Consumers query index alias `catalog-search`. Switching the alias from `catalog-products-v1` to `catalog-products-v2` happens atomically in a single cluster API call with 0ms downtime.
3. **Rollback Capability**: If unforeseen anomalies emerge immediately after the alias flip, the alias can be instantly pointed back to `v1`.
