import type { EnvConfig } from '@config/env';
import type { Logger } from '@config/logger';
import type { RequestHandler, Router } from 'express';

import { CartService } from './application/CartService';
import { MongoCartCatalogAdapter } from './infrastructure/catalog/cart-catalog.adapter';
import { MongoCartRepository } from './infrastructure/database/cart.repository';
import { createCartRoutes } from './presentation/routes/cart.routes';

export interface CartSharedDeps {
  logger: Logger;
  config: EnvConfig;
  authMiddleware: RequestHandler;
  productRepository: {
    findById(
      id: string,
    ): Promise<import('@modules/catalog/domain/entities/Product').Product | null>;
    findBySlug(
      slug: string,
    ): Promise<import('@modules/catalog/domain/entities/Product').Product | null>;
  };
  variantRepository: {
    findById(
      id: string,
    ): Promise<import('@modules/catalog/domain/entities/Variant').Variant | null>;
    findBySku(
      sku: string,
    ): Promise<import('@modules/catalog/domain/entities/Variant').Variant | null>;
    findActiveByProduct(
      productId: string,
    ): Promise<import('@modules/catalog/domain/entities/Variant').Variant[]>;
  };
}

export function createCartDependencies(shared: CartSharedDeps): {
  cartService: CartService;
  cartRoutes: Router;
  cartRepository: MongoCartRepository;
} {
  const cartRepository = new MongoCartRepository(shared.logger);
  const catalog = new MongoCartCatalogAdapter(
    shared.productRepository as never,
    shared.variantRepository as never,
  );
  const cartService = new CartService(cartRepository, catalog, shared.logger);
  const cartRoutes = createCartRoutes({
    cartService,
    authMiddleware: shared.authMiddleware,
    logger: shared.logger,
  });
  return { cartService, cartRoutes, cartRepository };
}
