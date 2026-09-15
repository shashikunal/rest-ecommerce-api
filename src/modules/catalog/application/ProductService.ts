import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';
import { ConcurrentUpdateError } from '@modules/users/domain/errors/UserErrors';
import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

import type { MediaRef, Product } from '../domain/entities/Product';
import { canTransitionProductStatus, isPubliclyVisible } from '../domain/entities/Product';
import type { Variant } from '../domain/entities/Variant';
import {
  BrandNotFoundError,
  CategoryNotFoundError,
  InvalidTransitionError,
  ProductNotFoundError,
  ProductNotPublishableError,
  SlugExistsError,
} from '../domain/errors/CatalogErrors';
import { buildCatalogEvent, type CatalogEventPublisher } from '../domain/events/CatalogEvents';
import { assertValidSlug, normalizeAttrs, slugify } from '../domain/policies/catalog-policies';
import type { CatalogCache, InventoryLookup } from '../domain/ports/CatalogPorts';
import type {
  ProductListOptions,
  ProductRepository,
} from '../domain/repositories/ProductRepository';
import type {
  BrandRepository,
  CategoryRepository,
} from '../domain/repositories/TaxonomyRepository';
import type { VariantRepository } from '../domain/repositories/VariantRepository';

export interface Actor {
  id: string;
  email: string;
}

export interface CreateProductInput {
  title: string;
  slug?: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  brandId?: string;
  attrs?: Record<string, unknown>;
  media?: MediaRef[];
  seo?: { title?: string; description?: string };
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  brandId?: string;
  attrs?: Record<string, unknown>;
  media?: MediaRef[];
  seo?: { title?: string; description?: string };
  version: number;
}

export interface VariantDTO {
  sku: string;
  attrs: Record<string, string>;
  price: { minor: number; currency: string };
  availability: string;
}

export interface ProductDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string; slug: string } | null;
  variants: VariantDTO[];
  media: MediaRef[];
  createdAt: Date;
  updatedAt: Date;
}

export const PRODUCT_DETAIL_CACHE_TTL = 300;

type MutableProduct = { -readonly [K in keyof Product]?: Product[K] };

function audit(
  logger: Logger,
  action: string,
  actor: Actor,
  resourceId: string,
  correlationId?: string,
  result = 'success',
): void {
  logger.info('Catalog audit', {
    actor: actor.id,
    action,
    resource: 'product',
    resourceId,
    result,
    correlationId,
  });
}

export function validateMediaRefs(media: MediaRef[] | undefined): MediaRef[] {
  if (!media) return [];
  if (media.length > 10) {
    throw new Error('Too many media references (max 10)');
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const seen = new Set<number>();
  return media.map((m, index) => {
    if (!m.mediaId || !m.key || !m.url || !m.type) {
      throw new Error(`Media reference ${index} is missing required fields`);
    }
    if (!allowedTypes.includes(m.type)) {
      throw new Error(`Unsupported media type: ${m.type}`);
    }
    if (seen.has(m.sortOrder)) {
      throw new Error('Duplicate media sortOrder');
    }
    seen.add(m.sortOrder);
    return {
      mediaId: String(m.mediaId).slice(0, 120),
      key: String(m.key).slice(0, 300),
      url: String(m.url).slice(0, 1000),
      type: m.type,
      altText: m.altText?.slice(0, 200),
      sortOrder: m.sortOrder,
      width: m.width,
      height: m.height,
      bytes: m.bytes,
    };
  });
}

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
    private readonly categories: CategoryRepository,
    private readonly brands: BrandRepository,
    private readonly events: CatalogEventPublisher,
    private readonly inventory: InventoryLookup,
    private readonly cache: CatalogCache,
    private readonly logger: Logger,
  ) {}

  async createProduct(
    input: CreateProductInput,
    actor: Actor,
    correlationId?: string,
  ): Promise<Product> {
    const category = await this.categories.findById(input.categoryId);
    if (!category || category.status !== 'active') {
      throw new CategoryNotFoundError('Category not found', correlationId);
    }
    if (input.brandId) {
      const brand = await this.brands.findById(input.brandId);
      if (!brand || brand.status !== 'active') {
        throw new BrandNotFoundError('Brand not found', correlationId);
      }
    }
    const slug = (input.slug ?? slugify(input.title)).toLowerCase();
    try {
      assertValidSlug(slug);
    } catch {
      throw new SlugExistsError(slug, correlationId);
    }
    if (await this.products.existsBySlug(slug)) {
      throw new SlugExistsError(slug, correlationId);
    }
    let attrs: Record<string, string> = {};
    if (input.attrs) {
      try {
        attrs = normalizeAttrs(input.attrs);
      } catch (error) {
        throw new InvalidTransitionError((error as Error).message, correlationId);
      }
    }
    let media: MediaRef[] = [];
    try {
      media = validateMediaRefs(input.media);
    } catch (error) {
      throw new InvalidTransitionError((error as Error).message, correlationId);
    }

    const now = new Date();
    const product: Product = {
      id: randomUUID(),
      title: input.title.trim(),
      slug,
      description: input.description,
      shortDescription: input.shortDescription,
      categoryId: input.categoryId,
      brandId: input.brandId,
      attrs,
      media,
      status: 'draft',
      seo: input.seo,
      version: 0,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.products.create(product);
    audit(this.logger, 'PRODUCT_CREATED', actor, product.id, correlationId);
    await this.emit(
      'catalog.productCreated',
      'product',
      product.id,
      { productId: product.id, slug },
      correlationId,
    );
    await this.emit(
      'search.indexRequested',
      'product',
      product.id,
      { productId: product.id },
      correlationId,
    );
    return product;
  }

  async updateProduct(
    id: string,
    input: UpdateProductInput,
    actor: Actor,
    correlationId?: string,
  ): Promise<Product> {
    const product = await this.requireProduct(id, correlationId);
    if (product.version !== input.version) {
      throw new ConcurrentUpdateError('Product was modified by another request', correlationId);
    }
    const updates: MutableProduct = {};
    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.description !== undefined) updates.description = input.description;
    if (input.shortDescription !== undefined) updates.shortDescription = input.shortDescription;
    if (input.categoryId !== undefined) {
      const category = await this.categories.findById(input.categoryId);
      if (!category || category.status !== 'active') {
        throw new CategoryNotFoundError('Category not found', correlationId);
      }
      updates.categoryId = input.categoryId;
    }
    if (input.brandId !== undefined) {
      const brand = await this.brands.findById(input.brandId);
      if (!brand || brand.status !== 'active') {
        throw new BrandNotFoundError('Brand not found', correlationId);
      }
      updates.brandId = input.brandId;
    }
    if (input.attrs !== undefined) {
      try {
        updates.attrs = normalizeAttrs(input.attrs);
      } catch (error) {
        throw new InvalidTransitionError((error as Error).message, correlationId);
      }
    }
    if (input.media !== undefined) {
      try {
        updates.media = validateMediaRefs(input.media);
      } catch (error) {
        throw new InvalidTransitionError((error as Error).message, correlationId);
      }
    }
    if (input.seo !== undefined) updates.seo = input.seo;
    updates.version = product.version + 1;

    await this.products.update(id, updates);
    await this.cache.invalidate(`product:*`);
    audit(this.logger, 'PRODUCT_UPDATED', actor, id, correlationId);
    await this.emit(
      'catalog.productUpdated',
      'product',
      id,
      { productId: id, version: updates.version },
      correlationId,
    );
    await this.emit(
      'search.indexUpdated',
      'product',
      id,
      { productId: id, version: updates.version },
      correlationId,
    );
    return this.requireProduct(id, correlationId);
  }

  async publishProduct(id: string, actor: Actor, correlationId?: string): Promise<Product> {
    const product = await this.requireProduct(id, correlationId);
    if (!canTransitionProductStatus(product.status, 'published')) {
      throw new InvalidTransitionError(
        `Cannot publish product from status ${product.status}`,
        correlationId,
      );
    }
    const activeVariants = await this.variants.countActiveByProduct(id);
    if (activeVariants < 1) {
      throw new ProductNotPublishableError(
        'Product requires at least one active variant before publishing',
        correlationId,
      );
    }
    await this.products.updateStatus(id, 'published', product.version + 1);
    await this.cache.invalidate(`product:*`);
    audit(this.logger, 'PRODUCT_PUBLISHED', actor, id, correlationId);
    await this.emit('catalog.productPublished', 'product', id, { productId: id }, correlationId);
    await this.emit('search.indexUpdated', 'product', id, { productId: id }, correlationId);
    return this.requireProduct(id, correlationId);
  }

  async unpublishProduct(id: string, actor: Actor, correlationId?: string): Promise<Product> {
    const product = await this.requireProduct(id, correlationId);
    if (!canTransitionProductStatus(product.status, 'draft')) {
      throw new InvalidTransitionError(
        `Cannot unpublish product from status ${product.status}`,
        correlationId,
      );
    }
    await this.products.updateStatus(id, 'draft', product.version + 1);
    await this.cache.invalidate(`product:*`);
    audit(this.logger, 'PRODUCT_UNPUBLISHED', actor, id, correlationId);
    await this.emit('catalog.productUnpublished', 'product', id, { productId: id }, correlationId);
    await this.emit('search.indexRemoved', 'product', id, { productId: id }, correlationId);
    return this.requireProduct(id, correlationId);
  }

  async archiveProduct(id: string, actor: Actor, correlationId?: string): Promise<Product> {
    const product = await this.requireProduct(id, correlationId);
    if (!canTransitionProductStatus(product.status, 'archived')) {
      throw new InvalidTransitionError(
        `Cannot archive product from status ${product.status}`,
        correlationId,
      );
    }
    const updates: MutableProduct = {
      status: 'archived',
      deletedAt: new Date(),
      version: product.version + 1,
    };
    await this.products.update(id, updates);
    await this.cache.invalidate(`product:*`);
    audit(this.logger, 'PRODUCT_ARCHIVED', actor, id, correlationId);
    await this.emit(
      'catalog.productUpdated',
      'product',
      id,
      { productId: id, status: 'archived' },
      correlationId,
    );
    await this.emit('search.indexRemoved', 'product', id, { productId: id }, correlationId);
    return this.requireProduct(id, correlationId);
  }

  async getAdminProduct(id: string): Promise<{ product: Product; variants: Variant[] }> {
    const product = await this.products.findById(id);
    if (!product) throw new ProductNotFoundError();
    const variants = await this.variants.findAllByProduct(id);
    return { product, variants };
  }

  async getPublicList(options: ProductListOptions): Promise<{
    data: ProductDTO[];
    pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
  }> {
    let result;
    try {
      result = await this.products.list({
        ...options,
        filters: { ...options.filters, status: 'published' },
      });
    } catch (error) {
      if ((error as Error).message === 'INVALID_CURSOR') {
        throw new AppError({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Invalid pagination cursor',
        });
      }
      throw error;
    }
    const data = await this.toDTOs(result.products);
    return {
      data,
      pagination: {
        limit: options.limit,
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
      },
    };
  }

  async getPublicDetail(slugOrId: string): Promise<{ dto: ProductDTO; etag: string }> {
    const key = `product:${slugOrId.toLowerCase()}`;
    const cached = await this.cache.get<{ dto: ProductDTO; etag: string }>(key);
    if (cached) return cached;

    let product = await this.products.findBySlug(slugOrId.toLowerCase());
    if (!product && /^[0-9a-f-]{8,}$/i.test(slugOrId)) {
      product = await this.products.findById(slugOrId);
    }
    if (!product || !isPubliclyVisible(product.status)) {
      throw new ProductNotFoundError();
    }
    const dtos = await this.toDTOs([product]);
    const dto = dtos[0]!;
    const etag = `W/"${product.version}-${new Date(product.updatedAt).getTime()}"`;
    const value = { dto, etag };
    await this.cache.set(key, value, PRODUCT_DETAIL_CACHE_TTL);
    return value;
  }

  async refreshMinPrice(productId: string): Promise<void> {
    const active = await this.variants.findActiveByProduct(productId);
    if (active.length === 0) {
      await this.products.clearMinPrice(productId);
      return;
    }
    const min = active.reduce((a, b) => (a.priceRef.amountMinor <= b.priceRef.amountMinor ? a : b));
    const product = await this.products.findById(productId);
    if (!product) return;
    await this.products.update(productId, {
      minPrice: { ...min.priceRef },
      version: product.version + 1,
    });
  }

  private async requireProduct(id: string, correlationId?: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw new ProductNotFoundError('Product not found', correlationId);
    return product;
  }

  private async toDTOs(products: Product[]): Promise<ProductDTO[]> {
    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const brandIds = [...new Set(products.map((p) => p.brandId).filter(Boolean))] as string[];
    const [categories, brands] = await Promise.all([
      Promise.all(categoryIds.map((id) => this.categories.findById(id))),
      Promise.all(brandIds.map((id) => this.brands.findById(id))),
    ]);
    const categoryById = new Map(categories.filter(Boolean).map((c) => [c!.id, c!]));
    const brandById = new Map(brands.filter(Boolean).map((b) => [b!.id, b!]));

    const variantLists = await Promise.all(
      products.map((p) => this.variants.findActiveByProduct(p.id)),
    );
    const allSkus = variantLists.flat().map((v) => v.sku);
    const availability = await this.inventory.availabilityFor(allSkus);

    return products.map((product, index) => {
      const category = categoryById.get(product.categoryId);
      const brand = product.brandId ? brandById.get(product.brandId) : undefined;
      const variants = (variantLists[index] ?? []).map((v) => ({
        sku: v.sku,
        attrs: v.attrs,
        price: { minor: v.priceRef.amountMinor, currency: v.priceRef.currency },
        availability: availability[v.sku] ?? 'UNKNOWN',
      }));
      return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        description: product.description,
        brand: brand ? { id: brand.id, name: brand.name } : null,
        category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
        variants,
        media: product.media,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });
  }

  private async emit(
    eventType: Parameters<typeof buildCatalogEvent>[0],
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    try {
      await this.events.publish(
        buildCatalogEvent(eventType, aggregateType, aggregateId, payload, { correlationId }),
      );
    } catch (error) {
      this.logger.warn('Catalog event publish failed (non-blocking)', {
        error: (error as Error).message,
      });
    }
  }
}
