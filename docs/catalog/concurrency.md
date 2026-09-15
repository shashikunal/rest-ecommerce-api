# Concurrency

- `version` on products and variants; every mutation requires the read version.
  Mismatch → `409 CONCURRENT_UPDATE` (client refetches). No silent overwrites.
- SKU/slug uniqueness enforced by unique indexes, not just service checks:
  concurrent duplicate creates converge with one `409` (service pre-check +
  duplicate-key catch as backstop).
- Variant attribute combinations unique per product via
  `uq_product_attrs {productId, attrSignature}`.
- Revoke-style races don't apply here, but publish/archive re-read state before
  transitioning, so concurrent lifecycle actions serialize on version + state.
- Category archive re-checks children and product references at write time.
