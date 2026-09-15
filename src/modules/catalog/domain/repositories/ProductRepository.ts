import type { Product, ProductStatus } from '../entities/Product';

export interface ProductFilters {
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  search?: string;
}

export type ProductSort = 'price' | '-price' | 'createdAt' | '-createdAt';

export interface ProductListOptions {
  filters: ProductFilters;
  sort: ProductSort;
  limit: number;
  cursor?: string | null;
}

export interface ProductListResult {
  products: Product[];
  nextCursor: string | null;
}

export interface ProductRepository {
  create(product: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  list(options: ProductListOptions): Promise<ProductListResult>;
  update(id: string, updates: Partial<Product>): Promise<void>;
  updateStatus(id: string, status: ProductStatus, version: number): Promise<void>;
  clearMinPrice(id: string): Promise<void>;
  existsBySlug(slug: string, exceptId?: string): Promise<boolean>;
  countByCategory(categoryId: string, statuses?: ProductStatus[]): Promise<number>;
  countByBrand(brandId: string, statuses?: ProductStatus[]): Promise<number>;
}
