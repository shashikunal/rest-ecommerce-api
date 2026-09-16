# Wishlist — Architecture

```text
routes (auth + zod + idempotency)
  → WishlistController (userId from req.user only)
    → WishlistService (lookup + graceful-state enrichment)
      → MongoWishlistRepository (conditional $push, $pull)
      → MongoWishlistCatalogAdapter (ProductRepository + VariantRepository)
```

- No Kafka/outbox (no cross-domain consumer in Phase 13, per ADR-009).
- Redis: idempotency records only (`idem:wishlist:*`, 24h TTL).
- Duplicate safety at two levels: app pre-check + conditional
  `findOneAndUpdate` with `$nor` on `(productId,variantId)` / `(productId,sku)`,
  so concurrent duplicate adds collapse to a single line (dup → 200).
- Pagination: cursor over `(addedAt DESC, itemId DESC)`, limit 1–50.

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Wishlist API
    participant Auth as Auth
    participant Catalog as Catalog
    participant DB as MongoDB
    C->>API: POST /wishlist/items {sku}
    API->>Auth: Validate identity
    Auth-->>API: User context
    API->>Catalog: Lookup product/variant
    Catalog-->>API: Info / 404
    API->>DB: Conditional $push (dup-safe)
    DB-->>API: Wishlist (created or existing)
    API-->>C: 201/200 item
```
