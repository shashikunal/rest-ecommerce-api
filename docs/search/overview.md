# Search Overview

Phase 12 implements product search and filtering as a read-optimized boundary over Catalog. MongoDB remains the source of truth; search is a projection/read path that can move to OpenSearch/Elasticsearch later by replacing `ProductSearchProvider`.

```mermaid
flowchart TD
  Client-->API[Search API]-->Validation-->RateLimit[Backend Rate Limit]-->Cache{Redis Cache}
  Cache-- HIT -->Response
  Cache-- MISS -->Provider[ProductSearchProvider]-->DB[(MongoDB Catalog)]-->CacheWrite[Cache 60s]-->Response
```

```mermaid
flowchart LR
  Catalog-->Mongo[(MongoDB Source of Truth)]-->Outbox-->Kafka-->Consumer[Search Consumer]-->Index[(Search Index Projection)]
```

```mermaid
flowchart LR
  Write[Catalog Write]-->Truth[(Source of Truth)]-->Event-->Projection-->ReadModel[Search Read Model]
```

```mermaid
flowchart LR
  Mongo[(MongoDB)]-->Backfill-->NewIndex[New Search Index]-->Validate-->Alias[Switch Alias]-->Retire[Old Index Retired]
```
