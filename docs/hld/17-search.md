# 17 Search

Day-1: Atlas `$text` + compound filters (category/brand/price) + facet aggs + sort + cursor page. Index: text(name,description) + {categoryId,price} + {brandId}.
Migrate to OpenSearch/ES when: facet p95 > 600ms sustained, ranking/personalization needed, or index exceeds Atlas comfort. Migration: CDC/outbox → indexers (idempotent) → dual-read → cutover. No ES in v1.
