import { MediaService } from '@modules/catalog/application/MediaService';
import { ProductService } from '@modules/catalog/application/ProductService';
import { TaxonomyService } from '@modules/catalog/application/TaxonomyService';
import { VariantService } from '@modules/catalog/application/VariantService';
import { NullInventoryLookup } from '@modules/catalog/domain/ports/CatalogPorts';
import { ERROR_CODES } from '@shared/errors/error-codes';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  FakeBrandRepository,
  FakeCatalogCache,
  FakeCatalogEventPublisher,
  FakeCategoryRepository,
  FakeMediaStorage,
  FakeProductRepository,
  FakeVariantRepository,
  makeBrand,
  makeCategory,
  makeProduct,
  makeVariant,
} from '../../helpers/catalog-fakes';
import { testLogger } from '../../helpers/fakes';

const ACTOR = { id: 'admin-1', email: 'admin@example.com' };

function setup() {
  const products = new FakeProductRepository();
  const variants = new FakeVariantRepository();
  const categories = new FakeCategoryRepository();
  const brands = new FakeBrandRepository();
  const events = new FakeCatalogEventPublisher();
  const cache = new FakeCatalogCache();
  const inventory = new NullInventoryLookup();
  const productService = new ProductService(
    products,
    variants,
    categories,
    brands,
    events,
    inventory,
    cache,
    testLogger,
  );
  const variantService = new VariantService(products, variants, events, cache, testLogger, (id) =>
    productService.refreshMinPrice(id),
  );
  const taxonomyService = new TaxonomyService(categories, brands, products, cache, testLogger);
  const mediaService = new MediaService(new FakeMediaStorage(), testLogger);
  return {
    products,
    variants,
    categories,
    brands,
    events,
    cache,
    productService,
    variantService,
    taxonomyService,
    mediaService,
  };
}

describe('ProductService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
    void ctx.categories.store.set('cat-1', makeCategory());
    void ctx.brands.store.set('brand-1', makeBrand());
  });

  it('creates draft products with auto slug', async () => {
    const product = await ctx.productService.createProduct(
      { title: 'Pixel 8', description: 'A phone with enough detail', categoryId: 'cat-1' },
      ACTOR,
    );
    expect(product.status).toBe('draft');
    expect(product.slug).toBe('pixel-8');
    expect(product.version).toBe(0);
    expect(ctx.events.events.some((e) => e.eventType === 'catalog.productCreated')).toBe(true);
  });

  it('rejects unknown category and duplicate slug', async () => {
    await expect(
      ctx.productService.createProduct(
        { title: 'X', description: 'long enough description', categoryId: 'missing' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.CATEGORY_NOT_FOUND });
    await ctx.productService.createProduct(
      { title: 'Pixel 8', description: 'A phone with enough detail', categoryId: 'cat-1' },
      ACTOR,
    );
    await expect(
      ctx.productService.createProduct(
        { title: 'Pixel 8', description: 'Another description here', categoryId: 'cat-1' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.SLUG_EXISTS });
  });

  it('enforces optimistic concurrency on update', async () => {
    const product = await ctx.productService.createProduct(
      { title: 'Pixel 8', description: 'A phone with enough detail', categoryId: 'cat-1' },
      ACTOR,
    );
    const updated = await ctx.productService.updateProduct(
      product.id,
      { title: 'Pixel 8 Pro', version: 0 },
      ACTOR,
    );
    expect(updated.title).toBe('Pixel 8 Pro');
    expect(updated.version).toBe(1);
    await expect(
      ctx.productService.updateProduct(product.id, { title: 'Stale', version: 0 }, ACTOR),
    ).rejects.toMatchObject({ code: ERROR_CODES.CONCURRENT_UPDATE });
  });

  it('guards publishing: draft->published needs a variant', async () => {
    const product = await ctx.productService.createProduct(
      { title: 'Pixel 8', description: 'A phone with enough detail', categoryId: 'cat-1' },
      ACTOR,
    );
    await expect(ctx.productService.publishProduct(product.id, ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.PRODUCT_NOT_PUBLISHABLE,
    });
    await ctx.variantService.createVariant(
      product.id,
      {
        sku: 'PX8-1',
        attrs: { color: 'black' },
        priceRef: { amountMinor: 69900, currency: 'USD' },
      },
      ACTOR,
    );
    const published = await ctx.productService.publishProduct(product.id, ACTOR);
    expect(published.status).toBe('published');
    await expect(ctx.productService.publishProduct(product.id, ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
    });
  });

  it('hides non-published products from public reads', async () => {
    const product = await ctx.productService.createProduct(
      { title: 'Pixel 8', description: 'A phone with enough detail', categoryId: 'cat-1' },
      ACTOR,
    );
    await expect(ctx.productService.getPublicDetail(product.slug)).rejects.toMatchObject({
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
    });
  });

  it('assembles public DTO without internal fields', async () => {
    const product = await ctx.productService.createProduct(
      {
        title: 'Pixel 8',
        description: 'A phone with enough detail',
        categoryId: 'cat-1',
        brandId: 'brand-1',
      },
      ACTOR,
    );
    await ctx.variantService.createVariant(
      product.id,
      {
        sku: 'PX8-1',
        attrs: { color: 'black' },
        priceRef: { amountMinor: 69900, currency: 'USD' },
      },
      ACTOR,
    );
    await ctx.productService.publishProduct(product.id, ACTOR);
    const { dto } = await ctx.productService.getPublicDetail(product.slug);
    expect(dto.variants[0]).toEqual({
      sku: 'PX8-1',
      attrs: { color: 'black' },
      price: { minor: 69900, currency: 'USD' },
      availability: 'UNKNOWN',
    });
    expect(dto).not.toHaveProperty('version');
    expect(dto).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(dto)).not.toContain('__v');
  });
});

describe('VariantService', () => {
  let ctx: ReturnType<typeof setup>;
  let productId: string;

  beforeEach(async () => {
    ctx = setup();
    void ctx.categories.store.set('cat-1', makeCategory());
    const product = await ctx.productService.createProduct(
      { title: 'Shirt', description: 'A shirt with enough detail', categoryId: 'cat-1' },
      ACTOR,
    );
    productId = product.id;
  });

  it('normalizes SKU and rejects duplicates', async () => {
    await ctx.variantService.createVariant(
      productId,
      {
        sku: 'shirt-red-m',
        attrs: { color: 'red', size: 'M' },
        priceRef: { amountMinor: 1000, currency: 'USD' },
      },
      ACTOR,
    );
    await expect(
      ctx.variantService.createVariant(
        productId,
        {
          sku: ' SHIRT-red-m ',
          attrs: { color: 'blue' },
          priceRef: { amountMinor: 1000, currency: 'USD' },
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.SKU_EXISTS });
  });

  it('rejects duplicate attribute combinations', async () => {
    await ctx.variantService.createVariant(
      productId,
      {
        sku: 'A-1',
        attrs: { color: 'red', size: 'M' },
        priceRef: { amountMinor: 1000, currency: 'USD' },
      },
      ACTOR,
    );
    await expect(
      ctx.variantService.createVariant(
        productId,
        {
          sku: 'A-2',
          attrs: { size: 'M', color: 'red' },
          priceRef: { amountMinor: 1200, currency: 'USD' },
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_TRANSITION });
  });

  it('keeps SKU and attrs immutable on update', async () => {
    const variant = await ctx.variantService.createVariant(
      productId,
      { sku: 'A-1', attrs: { color: 'red' }, priceRef: { amountMinor: 1000, currency: 'USD' } },
      ACTOR,
    );
    const updated = await ctx.variantService.updateVariant(
      variant.id,
      { priceRef: { amountMinor: 900, currency: 'USD' }, version: 0 },
      ACTOR,
    );
    expect(updated.priceRef.amountMinor).toBe(900);
    expect(updated.sku).toBe('A-1');
    expect(updated.version).toBe(1);
  });

  it('refuses variant deletion on published products', async () => {
    const variant = await ctx.variantService.createVariant(
      productId,
      { sku: 'A-1', attrs: { color: 'red' }, priceRef: { amountMinor: 1000, currency: 'USD' } },
      ACTOR,
    );
    await ctx.productService.publishProduct(productId, ACTOR);
    await expect(ctx.variantService.removeVariant(variant.id, ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
    });
  });

  it('recomputes product min price', async () => {
    await ctx.variantService.createVariant(
      productId,
      { sku: 'A-1', attrs: { color: 'red' }, priceRef: { amountMinor: 2000, currency: 'USD' } },
      ACTOR,
    );
    await ctx.variantService.createVariant(
      productId,
      { sku: 'A-2', attrs: { color: 'blue' }, priceRef: { amountMinor: 1500, currency: 'USD' } },
      ACTOR,
    );
    const product = await ctx.products.findById(productId);
    expect(product?.minPrice?.amountMinor).toBe(1500);
  });
});

describe('TaxonomyService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('creates root and child categories with paths', async () => {
    const root = await ctx.taxonomyService.createCategory({ name: 'Electronics' }, ACTOR);
    expect(root.path).toBe('/electronics');
    const child = await ctx.taxonomyService.createCategory(
      { name: 'Smartphones', parentId: root.id },
      ACTOR,
    );
    expect(child.path).toBe('/electronics/smartphones');
  });

  it('prevents depth beyond one level (cycle-safe by construction)', async () => {
    const root = await ctx.taxonomyService.createCategory({ name: 'Electronics' }, ACTOR);
    const child = await ctx.taxonomyService.createCategory(
      { name: 'Phones', parentId: root.id },
      ACTOR,
    );
    await expect(
      ctx.taxonomyService.createCategory({ name: 'Smart', parentId: child.id }, ACTOR),
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_CATEGORY });
  });

  it('rejects archiving categories with children or products', async () => {
    const root = await ctx.taxonomyService.createCategory({ name: 'Electronics' }, ACTOR);
    await ctx.taxonomyService.createCategory({ name: 'Phones', parentId: root.id }, ACTOR);
    await expect(ctx.taxonomyService.archiveCategory(root.id, ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.CATEGORY_IN_USE,
    });
    void ctx.products.store.set('p1', makeProduct({ categoryId: root.id }));
    const leaf = await ctx.taxonomyService.createCategory({ name: 'Laptops' }, ACTOR);
    void ctx.products.store.set('p2', makeProduct({ id: 'p2', slug: 's2', categoryId: leaf.id }));
    await expect(ctx.taxonomyService.archiveCategory(leaf.id, ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.CATEGORY_IN_USE,
    });
  });

  it('enforces brand slug uniqueness', async () => {
    await ctx.taxonomyService.createBrand({ name: 'Acme' }, ACTOR);
    await expect(ctx.taxonomyService.createBrand({ name: 'Acme' }, ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.SLUG_EXISTS,
    });
  });
});

describe('MediaService', () => {
  it('mints upload URLs for allowed types', async () => {
    const ctx = setup();
    const result = await ctx.mediaService.requestUploadUrl(
      { contentType: 'image/jpeg', sizeBytes: 1024, ownerType: 'product' },
      ACTOR,
    );
    expect(result.objectKey).toContain('product/');
    expect(result.expiresIn).toBe(900);
  });

  it('rejects oversized uploads', async () => {
    const ctx = setup();
    await expect(
      ctx.mediaService.requestUploadUrl(
        { contentType: 'image/png', sizeBytes: 6 * 1024 * 1024, ownerType: 'product' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('Catalog events', () => {
  it('emits enveloped events with correlation', async () => {
    const ctx = setup();
    void ctx.categories.store.set('cat-1', makeCategory());
    const product = await ctx.productService.createProduct(
      { title: 'Pixel 8', description: 'A phone with enough detail', categoryId: 'cat-1' },
      ACTOR,
      'corr-1',
    );
    const created = ctx.events.events.find((e) => e.eventType === 'catalog.productCreated');
    expect(created).toMatchObject({
      producer: 'catalog-svc',
      aggregateType: 'product',
      aggregateId: product.id,
      correlationId: 'corr-1',
      eventVersion: 1,
      schemaVersion: 1,
    });
    expect(created?.eventId).toBeDefined();
    expect(created?.payload).not.toHaveProperty('passwordHash');
  });
});
