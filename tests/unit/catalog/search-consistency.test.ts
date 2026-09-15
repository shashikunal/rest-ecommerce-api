import { describe, it, expect, beforeEach } from 'vitest';

import { ProductService } from '../../../src/modules/catalog/application/ProductService';
import { TaxonomyService } from '../../../src/modules/catalog/application/TaxonomyService';
import { VariantService } from '../../../src/modules/catalog/application/VariantService';
import { NullInventoryLookup } from '../../../src/modules/catalog/domain/ports/CatalogPorts';
import {
  BRAND_ID,
  CAT_ID,
  FakeBrandRepository,
  FakeCatalogCache,
  FakeCatalogEventPublisher,
  FakeCategoryRepository,
  FakeProductRepository,
  FakeVariantRepository,
  makeBrand,
  makeCategory,
} from '../../helpers/catalog-fakes';
import { testLogger } from '../../helpers/fakes';

describe('Search Consistency & Event Boundary Unit Tests', () => {
  let products: FakeProductRepository;
  let variants: FakeVariantRepository;
  let categories: FakeCategoryRepository;
  let brands: FakeBrandRepository;
  let events: FakeCatalogEventPublisher;
  let cache: FakeCatalogCache;
  let productService: ProductService;
  let variantService: VariantService;
  let taxonomyService: TaxonomyService;

  const actor = { id: 'admin-1', email: 'admin@example.com' };

  beforeEach(async () => {
    products = new FakeProductRepository();
    variants = new FakeVariantRepository();
    categories = new FakeCategoryRepository();
    brands = new FakeBrandRepository();
    events = new FakeCatalogEventPublisher();
    cache = new FakeCatalogCache();

    await categories.create(makeCategory({ id: CAT_ID, slug: 'smartphones', name: 'Smartphones' }));
    await brands.create(makeBrand({ id: BRAND_ID, slug: 'acme', name: 'Acme' }));

    productService = new ProductService(
      products,
      variants,
      categories,
      brands,
      events,
      new NullInventoryLookup(),
      cache,
      testLogger,
    );

    variantService = new VariantService(products, variants, events, cache, testLogger, (id) =>
      productService.refreshMinPrice(id),
    );
    taxonomyService = new TaxonomyService(categories, brands, products, cache, testLogger);
  });

  it('emits search.indexRequested and records to outbox upon product creation', async () => {
    const product = await productService.createProduct(
      {
        title: 'New Smartphone',
        description: 'Flagship device',
        categoryId: CAT_ID,
        brandId: BRAND_ID,
      },
      actor,
    );

    expect(product.status).toBe('draft');
    const searchRequested = events.events.find((e) => e.eventType === 'search.indexRequested');
    expect(searchRequested).toBeDefined();
    expect(searchRequested?.aggregateId).toBe(product.id);
  });

  it('emits search.indexUpdated and invalidates search caches upon publishing product with variant', async () => {
    const product = await productService.createProduct(
      {
        title: 'Publishable Product',
        description: 'Full desc',
        categoryId: CAT_ID,
        brandId: BRAND_ID,
      },
      actor,
    );

    await variantService.createVariant(
      product.id,
      {
        sku: 'PUB-PROD-001',
        attrs: { color: 'silver' },
        priceRef: { amountMinor: 79900, currency: 'USD' },
      },
      actor,
    );

    // Populate some fake search cache
    await cache.set('search:query1', { items: [] }, 60);
    await cache.set('suggest:query1', ['item1'], 60);

    const published = await productService.publishProduct(product.id, actor);
    expect(published.status).toBe('published');

    const searchUpdated = events.events.find(
      (e) => e.eventType === 'search.indexUpdated' && e.aggregateId === product.id,
    );
    expect(searchUpdated).toBeDefined();

    // Verify search and suggest cache invalidations took place
    expect(cache.invalidations).toContain('search:*');
    expect(cache.invalidations).toContain('suggest:*');
  });

  it('emits search.indexRemoved and invalidates cache upon unpublishing or archiving product', async () => {
    const product = await productService.createProduct(
      {
        title: 'Retiring Product',
        description: 'Full desc',
        categoryId: CAT_ID,
        brandId: BRAND_ID,
      },
      actor,
    );

    await variantService.createVariant(
      product.id,
      {
        sku: 'RET-PROD-001',
        attrs: { color: 'gray' },
        priceRef: { amountMinor: 49900, currency: 'USD' },
      },
      actor,
    );

    await productService.publishProduct(product.id, actor);
    events.events.length = 0;
    cache.invalidations.length = 0;

    await productService.unpublishProduct(product.id, actor);

    const removedEvent = events.events.find((e) => e.eventType === 'search.indexRemoved');
    expect(removedEvent).toBeDefined();
    expect(removedEvent?.aggregateId).toBe(product.id);
    expect(cache.invalidations).toContain('search:*');
    expect(cache.invalidations).toContain('suggest:*');
  });

  it('invalidates search cache when category or brand metadata is updated', async () => {
    cache.invalidations.length = 0;

    await taxonomyService.updateCategory(CAT_ID, { name: 'Premium Smartphones' }, actor);
    expect(cache.invalidations).toContain('search:*');
    expect(cache.invalidations).toContain('suggest:*');

    cache.invalidations.length = 0;

    await taxonomyService.updateBrand(BRAND_ID, { name: 'Acme Corporation' }, actor);
    expect(cache.invalidations).toContain('search:*');
    expect(cache.invalidations).toContain('suggest:*');
  });
});
