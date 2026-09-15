import type { Product } from '@modules/catalog/domain/entities/Product';
import type { Brand, Category } from '@modules/catalog/domain/entities/Taxonomy';
import type { Variant } from '@modules/catalog/domain/entities/Variant';
import type {
  CatalogEventEnvelope,
  CatalogEventPublisher,
  OutboxRecord,
  OutboxRepository,
} from '@modules/catalog/domain/events/CatalogEvents';
import type {
  CatalogCache,
  InventoryLookup,
  MediaStorage,
} from '@modules/catalog/domain/ports/CatalogPorts';
import type {
  ProductListOptions,
  ProductListResult,
  ProductRepository,
} from '@modules/catalog/domain/repositories/ProductRepository';
import type {
  BrandRepository,
  CategoryRepository,
} from '@modules/catalog/domain/repositories/TaxonomyRepository';
import type { VariantRepository } from '@modules/catalog/domain/repositories/VariantRepository';

export const CAT_ID = '123e4567-e89b-42d3-a456-426614174011';
export const BRAND_ID = '123e4567-e89b-42d3-a456-426614174012';
export const PROD_ID = '123e4567-e89b-42d3-a456-426614174013';
export const VAR_ID = '123e4567-e89b-42d3-a456-426614174014';

export function makeCategory(overrides: Partial<Category> = {}): Category {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: CAT_ID,
    name: 'Electronics',
    slug: 'electronics',
    parentId: null,
    path: '/electronics',
    sortOrder: 0,
    status: 'active',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeBrand(overrides: Partial<Brand> = {}): Brand {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: BRAND_ID,
    name: 'Acme',
    slug: 'acme',
    status: 'active',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: PROD_ID,
    title: 'Test Product',
    slug: 'test-product',
    description: 'A test product description',
    categoryId: CAT_ID,
    brandId: BRAND_ID,
    attrs: {},
    media: [],
    status: 'draft',
    version: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeVariant(overrides: Partial<Variant> = {}): Variant {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: VAR_ID,
    productId: PROD_ID,
    sku: 'SKU-001',
    attrs: { color: 'red', size: 'M' },
    attrSignature: 'color=red|size=M',
    status: 'active',
    priceRef: { amountMinor: 1999, currency: 'USD' },
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export class FakeProductRepository implements ProductRepository {
  readonly store = new Map<string, Product>();

  async create(product: Product): Promise<void> {
    for (const existing of this.store.values()) {
      if (existing.slug === product.slug) throw new Error('E11000 duplicate slug');
    }
    this.store.set(product.id, { ...product });
  }

  async findById(id: string): Promise<Product | null> {
    const product = this.store.get(id);
    return product ? { ...product } : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    for (const product of this.store.values()) {
      if (product.slug === slug.toLowerCase()) return { ...product };
    }
    return null;
  }

  async list(options: ProductListOptions): Promise<ProductListResult> {
    const { filters, sort } = options;
    let items = [...this.store.values()].filter((p) => {
      if (filters.status && p.status !== filters.status) return false;
      if (filters.categoryId && p.categoryId !== filters.categoryId) return false;
      if (filters.brandId && p.brandId !== filters.brandId) return false;
      const price = p.minPrice?.amountMinor ?? 0;
      if (filters.minPriceMinor !== undefined && price < filters.minPriceMinor) return false;
      if (filters.maxPriceMinor !== undefined && price > filters.maxPriceMinor) return false;
      if (filters.search) {
        const hay = `${p.title} ${p.description}`.toLowerCase();
        if (
          !filters.search
            .toLowerCase()
            .split(/\s+/)
            .every((w) => hay.includes(w))
        )
          return false;
      }
      return true;
    });
    const descending = sort.startsWith('-');
    const keyOf = (p: Product): number =>
      sort === 'price' || sort === '-price'
        ? (p.minPrice?.amountMinor ?? 0)
        : new Date(p.createdAt).getTime();
    items = items.sort((a, b) => {
      const diff = keyOf(a) - keyOf(b);
      if (diff !== 0) return descending ? -diff : diff;
      return descending ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    });
    let start = 0;
    if (options.cursor) {
      try {
        const cursor = JSON.parse(Buffer.from(options.cursor, 'base64').toString('utf-8')) as {
          sortKey: number;
          id: string;
        };
        const index = items.findIndex((p) => keyOf(p) === cursor.sortKey && p.id === cursor.id);
        start = index >= 0 ? index + 1 : 0;
      } catch {
        throw new Error('INVALID_CURSOR');
      }
    }
    const page = items.slice(start, start + options.limit);
    const hasMore = start + options.limit < items.length;
    const last = page[page.length - 1];
    return {
      products: page.map((p) => ({ ...p })),
      nextCursor:
        hasMore && last
          ? Buffer.from(JSON.stringify({ sortKey: keyOf(last), id: last.id })).toString('base64')
          : null,
    };
  }

  async update(id: string, updates: Partial<Product>): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, { ...existing, ...updates });
  }

  async updateStatus(id: string, status: Product['status'], version: number): Promise<void> {
    await this.update(id, { status, version } as Partial<Product>);
  }

  async clearMinPrice(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (existing) this.store.set(id, { ...existing, minPrice: undefined });
  }

  async existsBySlug(slug: string, exceptId?: string): Promise<boolean> {
    for (const product of this.store.values()) {
      if (product.slug === slug.toLowerCase() && product.id !== exceptId) return true;
    }
    return false;
  }

  async countByCategory(categoryId: string, statuses?: Product['status'][]): Promise<number> {
    return [...this.store.values()].filter(
      (p) => p.categoryId === categoryId && (!statuses || statuses.includes(p.status)),
    ).length;
  }

  async countByBrand(brandId: string, statuses?: Product['status'][]): Promise<number> {
    return [...this.store.values()].filter(
      (p) => p.brandId === brandId && (!statuses || statuses.includes(p.status)),
    ).length;
  }
}

export class FakeVariantRepository implements VariantRepository {
  readonly store = new Map<string, Variant>();

  async create(variant: Variant): Promise<void> {
    for (const existing of this.store.values()) {
      if (existing.sku === variant.sku) throw new Error('E11000 duplicate sku');
      if (
        existing.productId === variant.productId &&
        existing.attrSignature === variant.attrSignature
      ) {
        throw new Error('E11000 duplicate attrs');
      }
    }
    this.store.set(variant.id, { ...variant });
  }

  async findById(id: string): Promise<Variant | null> {
    const variant = this.store.get(id);
    return variant ? { ...variant } : null;
  }

  async findBySku(sku: string): Promise<Variant | null> {
    for (const variant of this.store.values()) {
      if (variant.sku === sku.trim().toUpperCase()) return { ...variant };
    }
    return null;
  }

  async findActiveByProduct(productId: string): Promise<Variant[]> {
    return [...this.store.values()]
      .filter((v) => v.productId === productId && v.status === 'active')
      .map((v) => ({ ...v }));
  }

  async findAllByProduct(productId: string): Promise<Variant[]> {
    return [...this.store.values()].filter((v) => v.productId === productId).map((v) => ({ ...v }));
  }

  async update(id: string, updates: Partial<Variant>): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, { ...existing, ...updates });
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id);
  }

  async existsBySignature(
    productId: string,
    attrSignature: string,
    exceptId?: string,
  ): Promise<boolean> {
    for (const variant of this.store.values()) {
      if (
        variant.productId === productId &&
        variant.attrSignature === attrSignature &&
        variant.id !== exceptId
      ) {
        return true;
      }
    }
    return false;
  }

  async countActiveByProduct(productId: string): Promise<number> {
    return (await this.findActiveByProduct(productId)).length;
  }
}

export class FakeCategoryRepository implements CategoryRepository {
  readonly store = new Map<string, Category>();

  async create(category: Category): Promise<void> {
    this.store.set(category.id, { ...category });
  }

  async findById(id: string): Promise<Category | null> {
    const category = this.store.get(id);
    return category ? { ...category } : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    for (const category of this.store.values()) {
      if (category.slug === slug.toLowerCase()) return { ...category };
    }
    return null;
  }

  async findChildren(parentId: string): Promise<Category[]> {
    return [...this.store.values()].filter((c) => c.parentId === parentId).map((c) => ({ ...c }));
  }

  async findRoots(): Promise<Category[]> {
    return [...this.store.values()].filter((c) => c.parentId === null).map((c) => ({ ...c }));
  }

  async findAll(): Promise<Category[]> {
    return [...this.store.values()].map((c) => ({ ...c }));
  }

  async update(id: string, updates: Partial<Category>): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, { ...existing, ...updates });
  }

  async existsBySlug(slug: string, exceptId?: string): Promise<boolean> {
    for (const category of this.store.values()) {
      if (category.slug === slug.toLowerCase() && category.id !== exceptId) return true;
    }
    return false;
  }
}

export class FakeBrandRepository implements BrandRepository {
  readonly store = new Map<string, Brand>();

  async create(brand: Brand): Promise<void> {
    this.store.set(brand.id, { ...brand });
  }

  async findById(id: string): Promise<Brand | null> {
    const brand = this.store.get(id);
    return brand ? { ...brand } : null;
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    for (const brand of this.store.values()) {
      if (brand.slug === slug.toLowerCase()) return { ...brand };
    }
    return null;
  }

  async findAll(): Promise<Brand[]> {
    return [...this.store.values()].map((b) => ({ ...b }));
  }

  async update(id: string, updates: Partial<Brand>): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, { ...existing, ...updates });
  }

  async existsBySlug(slug: string, exceptId?: string): Promise<boolean> {
    for (const brand of this.store.values()) {
      if (brand.slug === slug.toLowerCase() && brand.id !== exceptId) return true;
    }
    return false;
  }
}

export class FakeCatalogEventPublisher implements CatalogEventPublisher {
  readonly events: CatalogEventEnvelope[] = [];

  async publish(event: CatalogEventEnvelope): Promise<void> {
    this.events.push(event);
  }
}

export class FakeOutboxRepository implements OutboxRepository {
  readonly records: OutboxRecord[] = [];

  async append(record: OutboxRecord): Promise<void> {
    this.records.push(record);
  }

  async claimPending(limit: number): Promise<OutboxRecord[]> {
    return this.records.filter((r) => r.status === 'PENDING').slice(0, limit);
  }

  async markSent(id: string): Promise<void> {
    const record = this.records.find((r) => r.id === id);
    if (record) this.records.splice(this.records.indexOf(record), 1);
  }
}

export class FakeCatalogCache implements CatalogCache {
  readonly store = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const prefix = pattern.replace(/\*$/, '');
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

export class FakeMediaStorage implements MediaStorage {
  async createUploadUrl(request: {
    contentType: string;
    sizeBytes: number;
    ownerType: string;
    extension: string;
  }): Promise<{ uploadUrl: string; objectKey: string; expiresIn: number }> {
    const objectKey = `${request.ownerType}/test.${request.extension}`;
    return { uploadUrl: `https://cdn.test/${objectKey}`, objectKey, expiresIn: 900 };
  }

  publicUrlFor(objectKey: string): string {
    return `https://cdn.test/${objectKey}`;
  }
}

export class FakeInventoryLookup implements InventoryLookup {
  constructor(
    private readonly availability: Record<string, 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN'> = {},
  ) {}

  async availabilityFor(
    skus: string[],
  ): Promise<Record<string, 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN'>> {
    const result: Record<string, 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN'> = {};
    for (const sku of skus) result[sku] = this.availability[sku] ?? 'UNKNOWN';
    return result;
  }
}
