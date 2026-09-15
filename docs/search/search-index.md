# Search Index Document Projection

## 1. Projected Search Document Model

The derived document projection represents a denormalized, read-optimized view of a catalog product:

```typescript
export interface SearchProductDocument {
  productId: string;
  slug: string;
  title: string;
  description: string;
  shortDescription?: string;
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string } | null;
  searchableAttributes: Record<string, string>;
  variants: Array<{
    sku: string;
    attrs: Record<string, string>;
    price: { minor: number; currency: string };
    availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  }>;
  catalogPrice?: { minor: number; currency: string };
  media: MediaRef[];
  status: 'published';
  createdAt: Date;
  updatedAt: Date;
  score?: number;
}
```

---

## 2. Information Hiding & Security Boundary
The search document projection strictly omits:
- Internal database audit metadata (e.g. `__v`, internal MongoDB `_id`).
- Cost of goods sold (COGS) and supplier data.
- Inventory warehouse locations and supplier replenishment flags.
- Private pricing rules and customer-specific discounts.
- Soft-deleted timestamps and draft versions.
