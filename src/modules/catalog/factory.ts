import type { EnvConfig } from '@config/env';
import type { Logger } from '@config/logger';
import type { Router, RequestHandler } from 'express';

import { MediaService } from './application/MediaService';
import { ProductSearchService } from './application/ProductSearchService';
import { ProductService } from './application/ProductService';
import { TaxonomyService } from './application/TaxonomyService';
import { VariantService } from './application/VariantService';
import { NullInventoryLookup, type InventoryLookup } from './domain/ports/CatalogPorts';
import { RedisCatalogCache } from './infrastructure/cache/redis-catalog-cache';
import { MongoOutboxRepository } from './infrastructure/database/outbox.repository';
import { MongoProductRepository } from './infrastructure/database/product.repository';
import {
  MongoCategoryRepository,
  MongoBrandRepository,
} from './infrastructure/database/taxonomy.repository';
import { MongoVariantRepository } from './infrastructure/database/variant.repository';
import { OutboxCatalogEventPublisher } from './infrastructure/events/catalog-event-publisher';
import { MongoProductSearchProvider } from './infrastructure/search/MongoProductSearchProvider';
import { LocalDevMediaStorage } from './infrastructure/storage/media-storage';
import {
  AdminCatalogController,
  PublicCatalogController,
} from './presentation/controllers/catalog.controller';
import { createCatalogRoutes } from './presentation/routes/catalog.routes';

export interface CatalogSharedDeps {
  logger: Logger;
  authMiddleware: RequestHandler;
  config: EnvConfig;
  inventoryLookup?: InventoryLookup;
}

export interface CatalogDependencies {
  productService: ProductService;
  variantService: VariantService;
  taxonomyService: TaxonomyService;
  mediaService: MediaService;
  searchService: ProductSearchService;
  publicController: PublicCatalogController;
  adminController: AdminCatalogController;
  catalogRoutes: Router;
}

export function createCatalogDependencies(shared: CatalogSharedDeps): CatalogDependencies {
  const productRepository = new MongoProductRepository(shared.logger);
  const variantRepository = new MongoVariantRepository(shared.logger);
  const categoryRepository = new MongoCategoryRepository(shared.logger);
  const brandRepository = new MongoBrandRepository(shared.logger);
  const outboxRepository = new MongoOutboxRepository(shared.logger);
  const events = new OutboxCatalogEventPublisher(outboxRepository, shared.logger);
  const inventory = shared.inventoryLookup ?? new NullInventoryLookup();
  const cache = new RedisCatalogCache(shared.logger);
  const storage = new LocalDevMediaStorage(shared.config.API_BASE_URL, shared.logger);

  const productService = new ProductService(
    productRepository,
    variantRepository,
    categoryRepository,
    brandRepository,
    events,
    inventory,
    cache,
    shared.logger,
  );
  const variantService = new VariantService(
    productRepository,
    variantRepository,
    events,
    cache,
    shared.logger,
    (productId: string) => productService.refreshMinPrice(productId),
  );
  const taxonomyService = new TaxonomyService(
    categoryRepository,
    brandRepository,
    productRepository,
    cache,
    shared.logger,
  );
  const mediaService = new MediaService(storage, shared.logger);
  const searchProvider = new MongoProductSearchProvider(
    productRepository,
    variantRepository,
    categoryRepository,
    brandRepository,
    shared.logger,
  );
  const searchService = new ProductSearchService(searchProvider, cache, shared.logger);

  const publicController = new PublicCatalogController(
    productService,
    taxonomyService,
    searchService,
  );
  const adminController = new AdminCatalogController(
    productService,
    variantService,
    taxonomyService,
    mediaService,
  );
  const catalogRoutes = createCatalogRoutes({
    productService,
    variantService,
    taxonomyService,
    mediaService,
    searchService,
    authMiddleware: shared.authMiddleware,
  });
  return {
    productService,
    variantService,
    taxonomyService,
    mediaService,
    searchService,
    publicController,
    adminController,
    catalogRoutes,
  };
}
