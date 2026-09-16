import type { EnvConfig } from '@config/env';
import type { Logger } from '@config/logger';
import type { MetricsCollector } from '@infrastructure/observability/metrics';
import type { RequestHandler, Router } from 'express';

import { InventoryService } from './application/InventoryService';
import { VariantBootstrapHandler } from './application/VariantBootstrapHandler';
import { MongoInventoryCatalogAdapter } from './infrastructure/catalog/inventory-catalog.adapter';
import { MongoInventoryRepository } from './infrastructure/database/inventory.repository';
import { MongoMovementRepository } from './infrastructure/database/movement.repository';
import { MongoReservationRepository } from './infrastructure/database/reservation.repository';
import { OutboxInventoryEventPublisher } from './infrastructure/events/inventory-event-publisher';
import { MongoInventoryLookup } from './infrastructure/lookup/mongo-inventory-lookup';
import { createInventoryRoutes } from './presentation/routes/inventory.routes';

export interface InventorySharedDeps {
  logger: Logger;
  config: EnvConfig;
  authMiddleware: RequestHandler;
  metrics?: MetricsCollector;
  productRepository: {
    findById(
      id: string,
    ): Promise<import('@modules/catalog/domain/entities/Product').Product | null>;
  };
  variantRepository: {
    findById(
      id: string,
    ): Promise<import('@modules/catalog/domain/entities/Variant').Variant | null>;
    findBySku(
      sku: string,
    ): Promise<import('@modules/catalog/domain/entities/Variant').Variant | null>;
  };
}

export function createInventoryDependencies(shared: InventorySharedDeps): {
  inventoryService: InventoryService;
  bootstrapHandler: VariantBootstrapHandler;
  inventoryLookup: MongoInventoryLookup;
  inventoryRoutes: Router;
  inventoryRepository: MongoInventoryRepository;
} {
  const inventoryRepository = new MongoInventoryRepository(shared.logger);
  const reservationRepository = new MongoReservationRepository(shared.logger);
  const movementRepository = new MongoMovementRepository(shared.logger);
  const catalog = new MongoInventoryCatalogAdapter(
    shared.productRepository as never,
    shared.variantRepository as never,
  );
  const events = new OutboxInventoryEventPublisher(shared.logger);
  const inventoryService = new InventoryService(
    inventoryRepository,
    reservationRepository,
    movementRepository,
    catalog,
    events,
    shared.logger,
    shared.metrics,
  );
  const bootstrapHandler = new VariantBootstrapHandler(
    inventoryRepository,
    movementRepository,
    catalog,
    shared.logger,
  );
  const inventoryLookup = new MongoInventoryLookup(inventoryRepository);
  const inventoryRoutes = createInventoryRoutes({
    inventoryService,
    authMiddleware: shared.authMiddleware,
    logger: shared.logger,
  });
  return {
    inventoryService,
    bootstrapHandler,
    inventoryLookup,
    inventoryRoutes,
    inventoryRepository,
  };
}
