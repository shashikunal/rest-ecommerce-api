# Search & Filtering Architecture Overview

## 1. Architectural Philosophy

In this production-grade e-commerce platform, **MongoDB remains the authoritative source of truth for the product catalog**. Search is treated strictly as a **read-optimized, derived projection**.

Under no circumstances is the search engine (whether MongoDB index-backed or future Elasticsearch/OpenSearch) treated as the transactional master of product inventory, pricing, or catalog state.

```mermaid
flowchart TD
  Client[API Client]-->API[Search & Filtering API]
  API-->Validation[Strict Zod & Parameter Normalization]
  Validation-->RateLimit[Redis Rate Limiter (60-120 req/min)]
  RateLimit-->Cache{Redis Cache}
  Cache-- HIT -->Response[HTTP 200 Response + Metadata]
  Cache-- MISS -->Provider[ProductSearchProvider Abstraction]
  Provider-->Projection[(Read-Optimized Search Model)]
  Projection-->CacheWrite[Store in Redis (TTL 60s)]
  CacheWrite-->Response
```

---

## 2. Decoupled Provider Port & Adapter Pattern

The application layer (`ProductSearchService`) depends exclusively on the domain port:

```typescript
export interface ProductSearchProvider {
  readonly name: string;
  search(query: SearchProductsQuery): Promise<SearchProductsResult>;
  suggest(query: string, limit: number): Promise<string[]>;
  index(document: SearchProductDocument): Promise<void>;
  update(document: SearchProductDocument): Promise<void>;
  remove(productId: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}
```

This ensures that transitioning from `MongoProductSearchProvider` to an external `OpenSearchProductSearchProvider` requires **zero changes** to:
- HTTP controllers and routes (`catalog.controller.ts`, `catalog.routes.ts`)
- Application services and orchestration (`ProductSearchService.ts`)
- Validation and cursor logic (`search-normalization.ts`)
- Public API contract and OpenAPI specs.

---

## 3. Asynchronous Event-Driven Projection Boundary

When catalog mutations occur (e.g. creating, updating, publishing, unpublishing, or archiving products, or modifying taxonomy and variants), transactional outbox records are created atomically with the database write. A Kafka publisher forwards these events to `commerce.search.events.v1`, which an indexing worker consumes to maintain the derived search index asynchronously.

```mermaid
flowchart LR
  Catalog[Catalog Domain]-->Mongo[(MongoDB Source of Truth)]
  Mongo-- Atomic Transaction -->Outbox[(Transactional Outbox)]
  Outbox-- Poller/CDC -->Kafka[Kafka commerce.search.events.v1]
  Kafka-->SearchConsumer[Search Projection Consumer]
  SearchConsumer-->SearchIndex[(Search Index / Read Model)]
```

---

## 4. Search Consistency Model

Search is **eventually consistent**. When a merchant updates a product title or changes a variant price, the transactional read model in MongoDB reflects the change immediately, while the search projection and Redis cache converge within seconds.

```mermaid
flowchart LR
  Write[Catalog Write]-->Truth[(MongoDB Master Source of Truth)]
  Truth-- Outbox Event -->Kafka[Kafka Event Stream]
  Kafka-->ProjectionWorker[Projection Worker]
  ProjectionWorker-->ReadModel[(Search Read Model)]
```

---

## 5. Zero-Downtime Reindexing Strategy

When schema updates, mapping changes, or relevance scoring algorithms require a complete reindex, the system executes a blue/green index migration without client interruption.

```mermaid
flowchart LR
  Mongo[(MongoDB Catalog Source)]-->Backfill[Reindexing Batch Worker]
  Backfill-->NewIndex[(New Search Index v2)]
  NewIndex-->Validate[Run Parity Verification]
  Validate-->Alias[Atomic Switch Search Alias]
  Alias-->OldIndex[Retire Old Search Index v1]
```
