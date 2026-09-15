import type { Logger } from '@config/logger';

import { decodeSearchCursor, encodeSearchCursor } from '../../application/search-normalization';
import type { Product } from '../../domain/entities/Product';
import type { ProductRepository } from '../../domain/repositories/ProductRepository';
import type {
  BrandRepository,
  CategoryRepository,
} from '../../domain/repositories/TaxonomyRepository';
import type { VariantRepository } from '../../domain/repositories/VariantRepository';
import type {
  ProductSearchProvider,
  SearchProductDocument,
  SearchProductsQuery,
  SearchProductsResult,
  SearchSort,
} from '../../domain/search/ProductSearchProvider';

function searchTextMatches(product: Product, query: string): boolean {
  const haystack =
    `${product.title} ${product.shortDescription ?? ''} ${product.description} ${Object.values(product.attrs).join(' ')}`.toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

function relevanceScore(product: Product, query?: string): number {
  if (!query) return 0;
  const title = product.title.toLowerCase();
  const desc = `${product.shortDescription ?? ''} ${product.description}`.toLowerCase();
  if (title === query) return 100;
  if (title.startsWith(query)) return 80;
  if (title.includes(query)) return 60;
  if (Object.values(product.attrs).join(' ').toLowerCase().includes(query)) return 40;
  if (desc.includes(query)) return 20;
  return 1;
}

function sortValue(product: Product, sort: SearchSort, score: number): string | number {
  switch (sort) {
    case 'price_asc':
    case 'price_desc':
      return product.minPrice?.amountMinor ?? 0;
    case 'name_asc':
      return product.title.toLowerCase();
    case 'relevance':
      return score;
    case 'newest':
    default:
      return new Date(product.createdAt).getTime();
  }
}

export class MongoProductSearchProvider implements ProductSearchProvider {
  readonly name = 'mongodb-catalog-search';

  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
    private readonly categories: CategoryRepository,
    private readonly brands: BrandRepository,
    private readonly logger: Logger,
  ) {}

  async search(query: SearchProductsQuery): Promise<SearchProductsResult> {
    const candidate = await this.products.list({
      filters: {
        status: 'published',
        categoryId: query.categoryId,
        brandId: query.brandId,
        minPriceMinor: query.minPriceMinor,
        maxPriceMinor: query.maxPriceMinor,
        search: query.query,
      },
      sort: this.toRepositorySort(query.sort),
      limit: 500,
    });
    let products = candidate.products;

    if (query.categorySlug) {
      const category = await this.categories.findBySlug(query.categorySlug);
      if (!category || category.status !== 'active') products = [];
      else {
        const all = await this.categories.findAll();
        const ids = new Set(
          all
            .filter(
              (c) =>
                c.status === 'active' &&
                (c.id === category.id || c.path.startsWith(`${category.path}/`)),
            )
            .map((c) => c.id),
        );
        products = products.filter((p) => ids.has(p.categoryId));
      }
    }
    if (query.brandSlug) {
      const brand = await this.brands.findBySlug(query.brandSlug);
      products =
        brand && brand.status === 'active' ? products.filter((p) => p.brandId === brand.id) : [];
    }
    if (query.query) products = products.filter((p) => searchTextMatches(p, query.query!));

    const variantLists = new Map<
      string,
      Awaited<ReturnType<VariantRepository['findActiveByProduct']>>
    >();
    await Promise.all(
      products.map(async (p) => {
        variantLists.set(p.id, await this.variants.findActiveByProduct(p.id));
      }),
    );

    if (query.attributes.length > 0) {
      products = products.filter((p) => {
        const active = variantLists.get(p.id) ?? [];
        return query.attributes.every((filter) => {
          const productValue = p.attrs[filter.key]?.toLowerCase();
          const productMatch = productValue ? filter.values.includes(productValue) : false;
          const variantMatch = active.some((v) => {
            const vv = v.attrs[filter.key]?.toLowerCase();
            return vv ? filter.values.includes(vv) : false;
          });
          return productMatch || variantMatch;
        });
      });
    }

    if (query.availability) {
      // Inventory is Phase 14. Current provider only knows UNKNOWN via catalog boundary.
      products = query.availability === 'unknown' ? products : [];
    }

    const decorated = products.map((p) => ({ product: p, score: relevanceScore(p, query.query) }));
    decorated.sort((a, b) => {
      const av = sortValue(a.product, query.sort, a.score);
      const bv = sortValue(b.product, query.sort, b.score);
      let cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      if (query.sort === 'price_desc' || query.sort === 'newest' || query.sort === 'relevance')
        cmp = -cmp;
      if (cmp !== 0) return cmp;
      return a.product.id.localeCompare(b.product.id);
    });

    let start = 0;
    if (query.cursor) {
      const cursor = decodeSearchCursor(query.cursor, query.sort);
      const idx = decorated.findIndex((d) => d.product.id === cursor.productId);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = decorated.slice(start, start + query.limit);
    const hasMore = start + query.limit < decorated.length;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeSearchCursor({
            sort: query.sort,
            sortValue: sortValue(last.product, query.sort, last.score),
            productId: last.product.id,
          })
        : null;
    const items = await Promise.all(
      page.map((d) => this.toSearchDocument(d.product, d.score, variantLists.get(d.product.id))),
    );
    return {
      items,
      pagination: { limit: query.limit, nextCursor, hasMore },
      metadata: {
        query: query.query ?? null,
        normalizedQuery: query.query ?? null,
        sort: query.sort,
        total: null,
        totalRelation: 'not_computed',
        provider: this.name,
        cached: false,
      },
    };
  }

  async suggest(query: string, limit: number): Promise<string[]> {
    const result = await this.search({
      attributes: [],
      query,
      sort: 'relevance',
      limit: Math.min(limit, 10),
    });
    const suggestions = new Set<string>();
    for (const item of result.items) {
      suggestions.add(item.title);
      if (item.brand) suggestions.add(item.brand.name);
      if (item.category) suggestions.add(item.category.name);
    }
    return [...suggestions].slice(0, limit);
  }

  async index(_document: SearchProductDocument): Promise<void> {
    this.logger.debug('Mongo search indexes source catalog directly');
  }
  async update(document: SearchProductDocument): Promise<void> {
    await this.index(document);
  }
  async remove(_productId: string): Promise<void> {
    this.logger.debug('Mongo search removal is status-driven');
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }

  private toRepositorySort(sort: SearchSort): 'price' | '-price' | 'createdAt' | '-createdAt' {
    if (sort === 'price_asc') return 'price';
    if (sort === 'price_desc') return '-price';
    if (sort === 'newest' || sort === 'relevance') return '-createdAt';
    return 'createdAt';
  }

  private async toSearchDocument(
    product: Product,
    score: number,
    knownVariants?: Awaited<ReturnType<VariantRepository['findActiveByProduct']>>,
  ): Promise<SearchProductDocument> {
    const [category, brand, variants] = await Promise.all([
      this.categories.findById(product.categoryId),
      product.brandId ? this.brands.findById(product.brandId) : Promise.resolve(null),
      knownVariants
        ? Promise.resolve(knownVariants)
        : this.variants.findActiveByProduct(product.id),
    ]);
    return {
      productId: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      shortDescription: product.shortDescription,
      brand:
        brand && brand.status === 'active'
          ? { id: brand.id, name: brand.name, slug: brand.slug }
          : null,
      category:
        category && category.status === 'active'
          ? { id: category.id, name: category.name, slug: category.slug }
          : null,
      searchableAttributes: product.attrs,
      variants: variants.map((v) => ({
        sku: v.sku,
        attrs: v.attrs,
        price: { minor: v.priceRef.amountMinor, currency: v.priceRef.currency },
        availability: 'UNKNOWN',
      })),
      catalogPrice: product.minPrice
        ? { minor: product.minPrice.amountMinor, currency: product.minPrice.currency }
        : undefined,
      media: product.media,
      status: 'published',
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      score,
    };
  }
}
