import type { MediaRef } from '../entities/Product';

export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'name_asc';
export type AvailabilityFilter = 'in_stock' | 'out_of_stock' | 'unknown';

export interface SearchAttributeFilter {
  key: string;
  values: string[];
}

export interface SearchProductsQuery {
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  brandId?: string;
  brandSlug?: string;
  attributes: SearchAttributeFilter[];
  minPriceMinor?: number;
  maxPriceMinor?: number;
  availability?: AvailabilityFilter;
  sort: SearchSort;
  limit: number;
  cursor?: string;
}

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

export interface SearchProductsResult {
  items: SearchProductDocument[];
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
  metadata: {
    query: string | null;
    normalizedQuery: string | null;
    sort: SearchSort;
    total: null;
    totalRelation: 'not_computed';
    provider: string;
    cached: boolean;
  };
}

export interface ProductSearchProvider {
  readonly name: string;
  search(query: SearchProductsQuery): Promise<SearchProductsResult>;
  suggest(query: string, limit: number): Promise<string[]>;
  index(document: SearchProductDocument): Promise<void>;
  update(document: SearchProductDocument): Promise<void>;
  remove(productId: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}
