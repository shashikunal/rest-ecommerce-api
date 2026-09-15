import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { createApp } from '../../src/app/app';
import { envSchema } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';
import type { AuthRequest } from '../../src/modules/auth/middleware/auth.middleware';
import { MediaService } from '../../src/modules/catalog/application/MediaService';
import { ProductSearchService } from '../../src/modules/catalog/application/ProductSearchService';
import { ProductService } from '../../src/modules/catalog/application/ProductService';
import { TaxonomyService } from '../../src/modules/catalog/application/TaxonomyService';
import { VariantService } from '../../src/modules/catalog/application/VariantService';
import { NullInventoryLookup } from '../../src/modules/catalog/domain/ports/CatalogPorts';
import { MongoProductSearchProvider } from '../../src/modules/catalog/infrastructure/search/MongoProductSearchProvider';
import { createCatalogRoutes } from '../../src/modules/catalog/presentation/routes/catalog.routes';
import {
  BRAND_ID,
  CAT_ID,
  FakeBrandRepository,
  FakeCatalogCache,
  FakeCatalogEventPublisher,
  FakeCategoryRepository,
  FakeMediaStorage,
  FakeProductRepository,
  FakeVariantRepository,
  makeBrand,
  makeCategory,
} from '../helpers/catalog-fakes';

const config = envSchema.parse({
  MONGODB_URI: 'mongodb://localhost:27017/test',
  REDIS_URL: 'redis://localhost:6379',
  KAFKA_BROKERS: 'localhost:9092',
  KAFKA_CLIENT_ID: 'test',
  KAFKA_GROUP_ID: 'test-group',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CORS_ORIGINS: 'http://localhost:3000',
  FEATURE_SWAGGER_UI: false,
});
const logger = createLogger(config);

function stubAuth(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    req.user = {
      id: 'admin-1',
      email: 'admin@example.com',
      roles: [role],
      sessionId: 'sess-1',
      correlationId: req.correlationId ?? '',
    };
    next();
  };
}

describe('Product Search & Filtering Integration Tests', () => {
  let products: FakeProductRepository;
  let variants: FakeVariantRepository;
  let categories: FakeCategoryRepository;
  let brands: FakeBrandRepository;
  let events: FakeCatalogEventPublisher;
  let cache: FakeCatalogCache;

  function buildTestApp() {
    const productService = new ProductService(
      products,
      variants,
      categories,
      brands,
      events,
      new NullInventoryLookup(),
      cache,
      logger,
    );
    const variantService = new VariantService(products, variants, events, cache, logger, (id) =>
      productService.refreshMinPrice(id),
    );
    const taxonomyService = new TaxonomyService(categories, brands, products, cache, logger);
    const mediaService = new MediaService(new FakeMediaStorage(), logger);
    const searchProvider = new MongoProductSearchProvider(
      products,
      variants,
      categories,
      brands,
      logger,
    );
    const searchService = new ProductSearchService(searchProvider, cache, logger);

    const routes = createCatalogRoutes({
      productService,
      variantService,
      taxonomyService,
      mediaService,
      searchService,
      authMiddleware: stubAuth('admin'),
    });

    return createApp({
      config,
      logger,
      catalogRoutes: routes,
    });
  }

  beforeEach(async () => {
    products = new FakeProductRepository();
    variants = new FakeVariantRepository();
    categories = new FakeCategoryRepository();
    brands = new FakeBrandRepository();
    events = new FakeCatalogEventPublisher();
    cache = new FakeCatalogCache();

    // Create Category Hierarchy: Electronics -> Phones -> Flagships
    await categories.create(
      makeCategory({
        id: 'cat-elec',
        slug: 'electronics',
        name: 'Electronics',
        path: 'electronics',
      }),
    );
    await categories.create(
      makeCategory({
        id: 'cat-phones',
        slug: 'phones',
        name: 'Phones',
        parentId: 'cat-elec',
        path: 'electronics/phones',
      }),
    );
    await categories.create(
      makeCategory({
        id: 'cat-flagships',
        slug: 'flagships',
        name: 'Flagship Smartphones',
        parentId: 'cat-phones',
        path: 'electronics/phones/flagships',
      }),
    );

    // Create Brands
    await brands.create(makeBrand({ id: 'brand-apple', slug: 'apple', name: 'Apple' }));
    await brands.create(makeBrand({ id: 'brand-google', slug: 'google', name: 'Google' }));

    // Helper to add published products with variants
    const addProductWithVariant = async (params: {
      id: string;
      slug: string;
      title: string;
      description: string;
      categoryId: string;
      brandId: string;
      attrs: Record<string, string>;
      sku: string;
      variantAttrs: Record<string, string>;
      priceMinor: number;
      published?: boolean;
    }) => {
      await products.create({
        id: params.id,
        slug: params.slug,
        title: params.title,
        description: params.description,
        categoryId: params.categoryId,
        brandId: params.brandId,
        attrs: params.attrs,
        status: params.published === false ? 'draft' : 'published',
        minPrice: { amountMinor: params.priceMinor, currency: 'USD' },
        media: [],
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await variants.create({
        id: `var-${params.id}`,
        productId: params.id,
        sku: params.sku,
        attrs: params.variantAttrs,
        attrSignature: 'sig',
        status: 'active',
        priceRef: { amountMinor: params.priceMinor, currency: 'USD' },
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    };

    // Product 1: Apple iPhone 15 Pro
    await addProductWithVariant({
      id: 'prod-iphone-15',
      slug: 'iphone-15-pro',
      title: 'Apple iPhone 15 Pro',
      description: 'A17 Pro chip titanium design premium smartphone',
      categoryId: 'cat-flagships',
      brandId: 'brand-apple',
      attrs: { color: 'natural-titanium', os: 'ios' },
      sku: 'IPH15-TIT-128',
      variantAttrs: { storage: '128gb', color: 'titanium' },
      priceMinor: 99900, // $999.00
    });

    // Product 2: Google Pixel 8 Pro
    await addProductWithVariant({
      id: 'prod-pixel-8',
      slug: 'pixel-8-pro',
      title: 'Google Pixel 8 Pro',
      description: 'Tensor G3 best-in-class camera AI smartphone',
      categoryId: 'cat-flagships',
      brandId: 'brand-google',
      attrs: { color: 'obsidian', os: 'android' },
      sku: 'PIX8-OBS-256',
      variantAttrs: { storage: '256gb', color: 'black' },
      priceMinor: 89900, // $899.00
    });

    // Product 3: Apple iPhone 13 (Budget / Older)
    await addProductWithVariant({
      id: 'prod-iphone-13',
      slug: 'iphone-13',
      title: 'Apple iPhone 13',
      description: 'Reliable A15 bionic phone',
      categoryId: 'cat-phones',
      brandId: 'brand-apple',
      attrs: { color: 'blue', os: 'ios' },
      sku: 'IPH13-BLU-128',
      variantAttrs: { storage: '128gb', color: 'blue' },
      priceMinor: 59900, // $599.00
    });

    // Product 4: Draft product (should NOT show in search results)
    await addProductWithVariant({
      id: 'prod-draft',
      slug: 'future-unreleased-phone',
      title: 'Unreleased Prototype Phone',
      description: 'Top secret smartphone in testing',
      categoryId: 'cat-flagships',
      brandId: 'brand-apple',
      attrs: {},
      sku: 'PROTO-001',
      variantAttrs: {},
      priceMinor: 129900,
      published: false,
    });
  });

  it('searches products by text with relevance ordering', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/v1/products/search?q=iphone').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].title).toContain('iPhone');
    expect(res.body.data.pagination.limit).toBe(20);
    expect(res.body.data.pagination.hasMore).toBe(false);
  });

  it('filters by category with hierarchical path matching', async () => {
    const app = buildTestApp();

    // Querying parent category "electronics" matches products in subcategories "phones" and "flagships"
    const resParent = await request(app)
      .get('/api/v1/products/search?category=electronics')
      .expect(200);
    expect(resParent.body.data.items).toHaveLength(3);

    // Querying leaf category "flagships" matches only the 2 flagship devices
    const resLeaf = await request(app)
      .get('/api/v1/products/search?category=flagships')
      .expect(200);
    expect(resLeaf.body.data.items).toHaveLength(2);
  });

  it('filters by brand slug and ID', async () => {
    const app = buildTestApp();

    const resGoogle = await request(app).get('/api/v1/products/search?brand=google').expect(200);
    expect(resGoogle.body.data.items).toHaveLength(1);
    expect(resGoogle.body.data.items[0].brand.slug).toBe('google');

    const resApple = await request(app)
      .get('/api/v1/products/search?brandId=brand-apple')
      .expect(200);
    expect(resApple.body.data.items).toHaveLength(2);
  });

  it('filters by attribute values across product and variant attributes', async () => {
    const app = buildTestApp();

    // Match variant attribute storage:256gb
    const resStorage = await request(app)
      .get('/api/v1/products/search?attributes=storage:256gb')
      .expect(200);
    expect(resStorage.body.data.items).toHaveLength(1);
    expect(resStorage.body.data.items[0].productId).toBe('prod-pixel-8');

    // Match product attribute os:ios
    const resOs = await request(app).get('/api/v1/products/search?attributes=os:ios').expect(200);
    expect(resOs.body.data.items).toHaveLength(2);
  });

  it('filters by price range (minPrice and maxPrice)', async () => {
    const app = buildTestApp();

    const resPrice = await request(app)
      .get('/api/v1/products/search?minPrice=800&maxPrice=950')
      .expect(200);

    expect(resPrice.body.data.items).toHaveLength(1);
    expect(resPrice.body.data.items[0].productId).toBe('prod-pixel-8');
  });

  it('sorts correctly by price_asc, price_desc, and name_asc', async () => {
    const app = buildTestApp();

    const resAsc = await request(app).get('/api/v1/products/search?sort=price_asc').expect(200);
    const pricesAsc = resAsc.body.data.items.map(
      (i: { catalogPrice: { minor: number } }) => i.catalogPrice.minor,
    );
    expect(pricesAsc).toEqual([59900, 89900, 99900]);

    const resDesc = await request(app).get('/api/v1/products/search?sort=price_desc').expect(200);
    const pricesDesc = resDesc.body.data.items.map(
      (i: { catalogPrice: { minor: number } }) => i.catalogPrice.minor,
    );
    expect(pricesDesc).toEqual([99900, 89900, 59900]);

    const resName = await request(app).get('/api/v1/products/search?sort=name_asc').expect(200);
    expect(resName.body.data.items[0].title).toBe('Apple iPhone 13');
  });

  it('supports cursor-based deterministic pagination across pages', async () => {
    const app = buildTestApp();

    // Request page 1 with limit 2
    const page1 = await request(app)
      .get('/api/v1/products/search?sort=price_asc&limit=2')
      .expect(200);

    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.pagination.hasMore).toBe(true);
    const cursor = page1.body.data.pagination.nextCursor;
    expect(cursor).toBeTruthy();

    // Request page 2 with nextCursor
    const page2 = await request(app)
      .get(`/api/v1/products/search?sort=price_asc&limit=2&cursor=${cursor}`)
      .expect(200);

    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.items[0].productId).toBe('prod-iphone-15');
    expect(page2.body.data.pagination.hasMore).toBe(false);
    expect(page2.body.data.pagination.nextCursor).toBeNull();
  });

  it('returns typeahead suggestions', async () => {
    const app = buildTestApp();

    const res = await request(app).get('/api/v1/products/suggestions?q=iph&limit=5').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.suggestions).toContain('Apple iPhone 15 Pro');
  });

  it('enforces product visibility: draft products never appear in public search', async () => {
    const app = buildTestApp();

    const res = await request(app).get('/api/v1/products/search?q=prototype').expect(200);

    expect(res.body.data.items).toHaveLength(0);
  });

  it('returns empty list gracefully for zero-match search', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .get('/api/v1/products/search?q=nonexistentproductterm')
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.pagination.hasMore).toBe(false);
    expect(res.body.data.metadata.total).toBeNull();
  });

  it('rejects malformed, oversized, or malicious search queries with 400', async () => {
    const app = buildTestApp();

    // Oversized query
    await request(app)
      .get(`/api/v1/products/search?q=${'a'.repeat(101)}`)
      .expect(400);

    // Unsupported sort parameter
    await request(app).get('/api/v1/products/search?sort=injected_field').expect(400);

    // Inverted min/max prices
    await request(app).get('/api/v1/products/search?minPrice=500&maxPrice=100').expect(400);

    // Tampered cursor
    await request(app).get('/api/v1/products/search?cursor=tampered_cursor_content').expect(400);

    // Malicious NoSQL injection object in attribute
    await request(app).get('/api/v1/products/search?attributes[$ne]=test').expect(400);
  });
});
