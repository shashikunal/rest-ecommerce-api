# Catalog Overview (Phase 11)

Owner: `src/modules/catalog` — products, variants, categories, brands, media
references. Single-module layout per `docs/architecture/lld/module-catalog.md`
(`CatalogService, SkuPolicy` own the four collections; search is read-only).

```text
Catalog
 ├── Products      (title, slug, attrs, media refs, status, minPrice projection)
 ├── Variants      (SKU, attrs, priceRef — purchasable unit)
 ├── Categories    (one-level tree + materialized path)
 ├── Brands        (name, slug, logo ref)
 └── Media refs    (S3/CDN pointers only, never blobs)
```

Explicit non-goals: inventory quantities (Phase 14), dynamic pricing (Phase 20),
search engine (Phase 12), cart/orders (later). Catalog exposes two boundaries
for them: `InventoryLookup` port (currently `NullInventoryLookup →
availability: UNKNOWN`) and catalog/search Kafka events.

## Request flow

```mermaid
flowchart TD
  Admin --> A[Authenticate] --> Z[Authorize: products:*] --> V[Validate: Zod strict]
  V --> S[Service: Product/Variant/Taxonomy/Media]
  S --> D[Domain: transitions, SKU/slug/attr policies, OCC]
  D --> R[Repository ports] --> M[(MongoDB: source of truth)]
  S --> O[Outbox: catalog.* + search.* events]
  S --> C[Redis: write-invalidate]
  S --> RES[DTO + correlationId]
```

```mermaid
flowchart TD
  Customer --> API[Public GET]
  API --> Cache{Redis 5m}
  Cache -->|HIT| RES[Response + Cache-Control + ETag]
  Cache -->|MISS| M[(MongoDB published only)]
  M --> Cache
  Cache --> RES
```

## Product lifecycle

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> published: publish (≥1 active variant)
  published --> draft: unpublish
  draft --> archived: archive
  published --> archived: archive
  archived --> [*]
```

No raw `PATCH {status}` — state changes only via
`POST /products/:id/publish|unpublish|archive`.

## Future search indexing

```mermaid
flowchart LR
  M[(MongoDB)] --> O[outbox_events PENDING]
  O --> W[External worker: Phase 25]
  W --> K[Kafka: commerce.catalog/search.events.v1]
  K --> SI[search-indexer]
  SI --> IDX[(Search index)]
```
