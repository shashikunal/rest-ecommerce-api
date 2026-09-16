import type { EnvConfig } from '@config/env';
import type { Logger } from '@config/logger';
import type { MetricsCollector } from '@infrastructure/observability/metrics';
import type { CartService } from '@modules/cart/application/CartService';
import type { InventoryService } from '@modules/inventory/application/InventoryService';
import type { UserService } from '@modules/users/application/UserService';
import type { RequestHandler, Router } from 'express';

import { CheckoutService } from './application/CheckoutService';
import { InlineCheckoutAddressResolver } from './infrastructure/address/inline-address';
import { CartServiceCheckoutCartAdapter } from './infrastructure/cart/checkout-cart.adapter';
import { MongoCheckoutCatalogAdapter } from './infrastructure/catalog/checkout-catalog.adapter';
import { MongoCheckoutRepository } from './infrastructure/database/checkout.repository';
import { InventoryServiceCheckoutInventoryAdapter } from './infrastructure/inventory/checkout-inventory.adapter';
import { DefaultCheckoutPricing } from './infrastructure/pricing/default-pricing';
import { UserServiceCheckoutUserAdapter } from './infrastructure/users/checkout-user.adapter';
import { createCheckoutRoutes } from './presentation/routes/checkout.routes';

export interface CheckoutSharedDeps {
  logger: Logger;
  config: EnvConfig;
  authMiddleware: RequestHandler;
  metrics?: MetricsCollector;
  cartService: CartService;
  inventoryService: InventoryService;
  userService: UserService;
  productRepository: {
    findById(
      id: string,
    ): Promise<import('@modules/catalog/domain/entities/Product').Product | null>;
  };
  variantRepository: {
    findBySku(
      sku: string,
    ): Promise<import('@modules/catalog/domain/entities/Variant').Variant | null>;
  };
}

export function createCheckoutDependencies(shared: CheckoutSharedDeps): {
  checkoutService: CheckoutService;
  checkoutRoutes: Router;
  checkoutRepository: MongoCheckoutRepository;
} {
  const checkoutRepository = new MongoCheckoutRepository(shared.logger);
  const carts = new CartServiceCheckoutCartAdapter(shared.cartService);
  const catalog = new MongoCheckoutCatalogAdapter(
    shared.productRepository as never,
    shared.variantRepository as never,
  );
  const pricing = new DefaultCheckoutPricing();
  const addresses = new InlineCheckoutAddressResolver();
  const users = new UserServiceCheckoutUserAdapter(shared.userService);
  const inventory = new InventoryServiceCheckoutInventoryAdapter(shared.inventoryService);
  const checkoutService = new CheckoutService(
    checkoutRepository,
    carts,
    catalog,
    pricing,
    addresses,
    users,
    inventory,
    shared.logger,
    shared.metrics,
  );
  const checkoutRoutes = createCheckoutRoutes({
    checkoutService,
    authMiddleware: shared.authMiddleware,
    logger: shared.logger,
  });
  return { checkoutService, checkoutRoutes, checkoutRepository };
}
