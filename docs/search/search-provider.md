# Search Provider Abstraction (Port & Adapter)

## 1. Domain Port Definition

The search provider interface encapsulates all search and indexing operations behind an immutable contract:

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

---

## 2. Implementations

### Current: `MongoProductSearchProvider`
- Operates directly against MongoDB catalog collections.
- Executes compound queries combining product status, category hierarchy path, brand slugs, price boundaries, and text terms.
- Performs in-memory relevance weighting and cursor pagination slicing.
- Fully production-grade for small-to-medium catalogs (< 100,000 SKUs).

### Future: `OpenSearchProductSearchProvider` / `ElasticsearchProductSearchProvider`
- When catalog scales to millions of SKUs, an adapter implementing `ProductSearchProvider` communicates with an external search cluster via REST/OpenSearch SDK.
- The rest of the codebase (HTTP routes, schemas, services, authentication, metrics) requires **zero modifications**.
