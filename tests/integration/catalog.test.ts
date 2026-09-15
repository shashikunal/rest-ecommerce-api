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
import { testLogger } from '../helpers/fakes';

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
    const headerRole = (req.headers['x-test-role'] as string | undefined) ?? role;
    if (headerRole === 'none') {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access token required' },
      });
      return;
    }
    req.user = {
      id: 'admin-1',
      email: 'admin@example.com',
      roles: [headerRole],
      sessionId: 'sess-1',
      correlationId: req.correlationId ?? '',
    };
    next();
  };
}

describe('Catalog API', () => {
  let products!: FakeProductRepository;
  let variants!: FakeVariantRepository;
  let categories!: FakeCategoryRepository;
  let brands!: FakeBrandRepository;
  let events!: FakeCatalogEventPublisher;
  let cache!: FakeCatalogCache;

  function app() {
    const eventsLocal = events;
    const productService = new ProductService(
      products,
      variants,
      categories,
      brands,
      eventsLocal,
      new NullInventoryLookup(),
      cache,
      testLogger,
    );
    const variantService = new VariantService(
      products,
      variants,
      eventsLocal,
      cache,
      testLogger,
      (id) => productService.refreshMinPrice(id),
    );
    const taxonomyService = new TaxonomyService(categories, brands, products, cache, testLogger);
    const mediaService = new MediaService(new FakeMediaStorage(), testLogger);
    const searchProvider = new MongoProductSearchProvider(
      products,
      variants,
      categories,
      brands,
      testLogger,
    );
    const searchService = new ProductSearchService(searchProvider, cache, testLogger);
    return createApp({
      config,
      logger,
      catalogRoutes: createCatalogRoutes({
        productService,
        variantService,
        taxonomyService,
        mediaService,
        searchService,
        authMiddleware: stubAuth('admin'),
      }),
    });
  }

  function authHeaders(role = 'admin'): Record<string, string> {
    return { 'x-test-role': role };
  }

  beforeEach(() => {
    products = new FakeProductRepository();
    variants = new FakeVariantRepository();
    categories = new FakeCategoryRepository();
    brands = new FakeBrandRepository();
    events = new FakeCatalogEventPublisher();
    cache = new FakeCatalogCache();
    void categories.store.set(CAT_ID, makeCategory());
    void brands.store.set(BRAND_ID, makeBrand());
  });

  async function seedPublished() {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/products')
      .set(authHeaders())
      .send({ title: 'Pixel 8', description: 'A phone with enough detail', categoryId: CAT_ID });
    const id = created.body.data.id as string;
    await agent
      .post(`/api/v1/products/${id}/variants`)
      .set(authHeaders())
      .send({
        sku: 'PX8-1',
        attrs: { color: 'black' },
        priceRef: { amountMinor: 69900, currency: 'USD' },
      });
    await agent.post(`/api/v1/products/${id}/publish`).set(authHeaders());
    return id;
  }

  it('runs admin flow: category -> brand -> product -> variant -> publish -> visible', async () => {
    const agent = request(app());
    const category = await agent
      .post('/api/v1/categories')
      .set(authHeaders())
      .send({ name: 'Mobiles' });
    expect(category.status).toBe(201);
    const brand = await agent.post('/api/v1/brands').set(authHeaders()).send({ name: 'Google' });
    expect(brand.status).toBe(201);
    const product = await agent.post('/api/v1/products').set(authHeaders()).send({
      title: 'Pixel 8',
      description: 'A phone with enough detail',
      categoryId: category.body.data.id,
      brandId: brand.body.data.id,
    });
    expect(product.status).toBe(201);
    expect(product.body.data.status).toBe('draft');
    const id = product.body.data.id as string;
    const variant = await agent
      .post(`/api/v1/products/${id}/variants`)
      .set(authHeaders())
      .send({
        sku: 'px8-128-blk',
        attrs: { color: 'black', storage: '128GB' },
        priceRef: { amountMinor: 69900, currency: 'USD' },
      });
    expect(variant.status).toBe(201);
    expect(variant.body.data.sku).toBe('PX8-128-BLK');
    await agent.post(`/api/v1/products/${id}/publish`).set(authHeaders()).expect(200);

    const detail = await agent.get('/api/v1/products/pixel-8');
    expect(detail.status).toBe(200);
    expect(detail.body.data.variants).toHaveLength(1);
    expect(detail.body.data.variants[0].price).toEqual({ minor: 69900, currency: 'USD' });
    expect(detail.headers['cache-control']).toContain('public');
    expect(detail.headers.etag).toBeDefined();
  });

  it('hides drafts and archives from public catalog', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/products')
      .set(authHeaders())
      .send({ title: 'Hidden', description: 'Hidden product description', categoryId: CAT_ID });
    const id = created.body.data.id as string;
    expect((await agent.get('/api/v1/products/hidden')).status).toBe(404);
    await agent
      .post(`/api/v1/products/${id}/variants`)
      .set(authHeaders())
      .send({
        sku: 'H-1',
        attrs: { color: 'red' },
        priceRef: { amountMinor: 100, currency: 'USD' },
      });
    await agent.post(`/api/v1/products/${id}/publish`).set(authHeaders());
    expect((await agent.get('/api/v1/products/hidden')).status).toBe(200);
    await agent.post(`/api/v1/products/${id}/archive`).set(authHeaders());
    const list = await agent.get('/api/v1/products');
    expect(list.body.data.data).toHaveLength(0);
    expect((await agent.get('/api/v1/products/hidden')).status).toBe(404);
  });

  it('paginates public listing with cursor envelope', async () => {
    const agent = request(app());
    for (let i = 0; i < 3; i += 1) {
      const created = await agent
        .post('/api/v1/products')
        .set(authHeaders())
        .send({
          title: `Phone ${i}`,
          description: `Phone ${i} description here`,
          categoryId: CAT_ID,
        });
      const id = created.body.data.id as string;
      await agent
        .post(`/api/v1/products/${id}/variants`)
        .set(authHeaders())
        .send({
          sku: `P-${i}`,
          attrs: { color: `c${i}` },
          priceRef: { amountMinor: 100 * (i + 1), currency: 'USD' },
        });
      await agent.post(`/api/v1/products/${id}/publish`).set(authHeaders());
    }
    const first = await agent.get('/api/v1/products?limit=2');
    expect(first.status).toBe(200);
    expect(first.body.data.data).toHaveLength(2);
    expect(first.body.data.pagination.hasMore).toBe(true);
    const cursor = first.body.data.pagination.nextCursor as string;
    const second = await agent.get(`/api/v1/products?limit=2&cursor=${encodeURIComponent(cursor)}`);
    expect(second.body.data.data).toHaveLength(1);
    expect(second.body.data.pagination.hasMore).toBe(false);
  });

  it('rejects duplicate SKU with 409', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/products')
      .set(authHeaders())
      .send({ title: 'Shirt', description: 'Shirt description here', categoryId: CAT_ID });
    const id = created.body.data.id as string;
    await agent
      .post(`/api/v1/products/${id}/variants`)
      .set(authHeaders())
      .send({
        sku: 'DUP-1',
        attrs: { color: 'red' },
        priceRef: { amountMinor: 100, currency: 'USD' },
      })
      .expect(201);
    const dup = await agent
      .post(`/api/v1/products/${id}/variants`)
      .set(authHeaders())
      .send({
        sku: 'dup-1',
        attrs: { color: 'blue' },
        priceRef: { amountMinor: 100, currency: 'USD' },
      });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SKU_EXISTS');
  });

  it('rejects duplicate slug with 409', async () => {
    const agent = request(app());
    const payload = {
      title: 'Same Name',
      description: 'Same name description',
      categoryId: CAT_ID,
    };
    await agent.post('/api/v1/products').set(authHeaders()).send(payload).expect(201);
    const dup = await agent.post('/api/v1/products').set(authHeaders()).send(payload);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SLUG_EXISTS');
  });

  it('returns 409 on stale product version', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/products')
      .set(authHeaders())
      .send({ title: 'V1', description: 'Versioned description', categoryId: CAT_ID });
    const id = created.body.data.id as string;
    await agent
      .patch(`/api/v1/products/${id}`)
      .set(authHeaders())
      .send({ title: 'V2', version: 0 })
      .expect(200);
    const stale = await agent
      .patch(`/api/v1/products/${id}`)
      .set(authHeaders())
      .send({ title: 'Stale', version: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONCURRENT_UPDATE');
  });

  it('blocks customer mutations with 403 and anonymous with 401', async () => {
    const agent = request(app());
    const asCustomer = await agent
      .post('/api/v1/products')
      .set(authHeaders('user'))
      .send({ title: 'Nope', description: 'Nope description here', categoryId: CAT_ID });
    expect(asCustomer.status).toBe(403);
    const anon = await agent
      .post('/api/v1/products')
      .set(authHeaders('none'))
      .send({ title: 'Nope', description: 'Nope description here', categoryId: CAT_ID });
    expect(anon.status).toBe(401);
  });

  it('rejects mass assignment of status and version', async () => {
    const agent = request(app());
    const res = await agent.post('/api/v1/products').set(authHeaders()).send({
      title: 'Mass',
      description: 'Mass assignment description',
      categoryId: CAT_ID,
      status: 'published',
      version: 99,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized payloads', async () => {
    const agent = request(app());
    const res = await agent
      .post('/api/v1/products')
      .set(authHeaders())
      .send({ title: 'x'.repeat(500), description: 'Valid description here', categoryId: CAT_ID });
    expect(res.status).toBe(400);
  });

  it('rejects invalid cursors with 400', async () => {
    const agent = request(app());
    const res = await agent.get('/api/v1/products?cursor=!!!not-base64!!!');
    expect(res.status).toBe(400);
  });

  it('mints media upload URLs for admins only', async () => {
    const agent = request(app());
    const ok = await agent
      .post('/api/v1/media/upload-url')
      .set(authHeaders())
      .send({ contentType: 'image/jpeg', sizeBytes: 1024, ownerType: 'product' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.objectKey).toContain('product/');
    const bad = await agent
      .post('/api/v1/media/upload-url')
      .set(authHeaders())
      .send({ contentType: 'image/gif', sizeBytes: 1024, ownerType: 'product' });
    expect(bad.status).toBe(400);
    const customer = await agent
      .post('/api/v1/media/upload-url')
      .set(authHeaders('user'))
      .send({ contentType: 'image/jpeg', sizeBytes: 1024, ownerType: 'product' });
    expect(customer.status).toBe(403);
  });

  it('serves category tree and brand list publicly', async () => {
    const agent = request(app());
    const root = await agent
      .post('/api/v1/categories')
      .set(authHeaders())
      .send({ name: 'Gadgets' });
    expect(root.status).toBe(201);
    await agent
      .post('/api/v1/categories')
      .set(authHeaders())
      .send({ name: 'Phones', parentId: root.body.data.id });
    const tree = await agent.get('/api/v1/categories');
    expect(tree.status).toBe(200);
    const gadgets = tree.body.data.find((c: { slug: string }) => c.slug === 'gadgets');
    expect(gadgets.children).toHaveLength(1);
    expect(tree.headers['cache-control']).toContain('public');
    const brands = await agent.get('/api/v1/brands');
    expect(brands.body.data[0].name).toBe('Acme');
  });

  it('searches products with filters, attributes, sort, cursor and suggestions', async () => {
    const agent = request(app());
    const phone = await agent
      .post('/api/v1/products')
      .set(authHeaders())
      .send({
        title: 'iPhone 15',
        description: 'Apple smartphone with excellent camera',
        categoryId: CAT_ID,
        brandId: BRAND_ID,
        attrs: { material: 'aluminum' },
      });
    const phoneId = phone.body.data.id as string;
    await agent
      .post(`/api/v1/products/${phoneId}/variants`)
      .set(authHeaders())
      .send({
        sku: 'IPH-15-BLK',
        attrs: { color: 'black', storage: '256gb' },
        priceRef: { amountMinor: 99900, currency: 'USD' },
      });
    await agent.post(`/api/v1/products/${phoneId}/publish`).set(authHeaders());

    const shirt = await agent.post('/api/v1/products').set(authHeaders()).send({
      title: 'Cotton Shirt',
      description: 'Comfortable cotton shirt for daily wear',
      categoryId: CAT_ID,
      brandId: BRAND_ID,
    });
    const shirtId = shirt.body.data.id as string;
    await agent
      .post(`/api/v1/products/${shirtId}/variants`)
      .set(authHeaders())
      .send({
        sku: 'SHIRT-RED',
        attrs: { color: 'red', size: 'm' },
        priceRef: { amountMinor: 2500, currency: 'USD' },
      });
    await agent.post(`/api/v1/products/${shirtId}/publish`).set(authHeaders());

    const res = await agent.get(
      '/api/v1/products/search?q=iphone&brand=acme&minPrice=500&maxPrice=1200&attributes=color:black&sort=relevance&limit=1',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].slug).toBe('iphone-15');
    expect(res.body.data.metadata.provider).toBe('mongodb-catalog-search');
    expect(res.body.data.metadata.totalRelation).toBe('not_computed');

    const first = await agent.get('/api/v1/products/search?sort=price_asc&limit=1');
    expect(first.body.data.pagination.hasMore).toBe(true);
    const cursor = first.body.data.pagination.nextCursor as string;
    const second = await agent.get(
      `/api/v1/products/search?sort=price_asc&limit=1&cursor=${encodeURIComponent(cursor)}`,
    );
    expect(second.status).toBe(200);
    expect(second.body.data.items[0].slug).toBe('iphone-15');

    const suggest = await agent.get('/api/v1/products/suggestions?q=iph');
    expect(suggest.status).toBe(200);
    expect(suggest.body.data.suggestions).toContain('iPhone 15');
  });

  it('rejects unsafe search queries and tampered cursors', async () => {
    const agent = request(app());
    expect((await agent.get(`/api/v1/products/search?q=${'x'.repeat(101)}`)).status).toBe(400);
    expect((await agent.get('/api/v1/products/search?sort=__proto__')).status).toBe(400);
    expect((await agent.get('/api/v1/products/search?minPrice=100&maxPrice=1')).status).toBe(400);
    expect((await agent.get('/api/v1/products/search?attributes[$ne]=x')).status).toBe(400);
    expect((await agent.get('/api/v1/products/search?cursor=tampered')).status).toBe(400);
  });

  it('supports ETag conditional requests', async () => {
    const agent = request(app());
    await seedPublished();
    const first = await agent.get('/api/v1/products/pixel-8');
    const etag = first.headers.etag as string;
    expect(etag).toBeDefined();
    const cached = await agent.get('/api/v1/products/pixel-8').set('If-None-Match', etag);
    expect(cached.status).toBe(304);
  });
});
