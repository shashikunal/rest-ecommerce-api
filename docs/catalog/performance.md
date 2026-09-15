# Performance

Indexes map 1:1 to query patterns: `uq_slug` (detail), `ix_cat_price`
(category browse + price sort), `$text` (search), `uq_sku` (SKU lookup),
`ix_product` (variant assembly), `uq_product_attrs` (dup guard), `uq_slug` on
taxonomy, `ix_parent` (tree). No status-only or per-field speculative indexes.

List/detail use projections (`-__v`), cursor pagination (max 50, `_id`
tiebreak, no skip), single-pass DTO assembly (batched category/brand/variant
fetches — no N+1), and cache-aside reads. Category tree resolves in two
indexed queries via the one-level + path design (no recursion).

Scaling: 10x = indexes + cache + pooling + pagination (done). 100x = read
replicas, Redis, derived search index, CDN. 1000x = search infra, workload
partitioning, read-model projections, sharding by `categoryId`/slug hash if
justified. Nothing premature implemented.
