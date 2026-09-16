import type { Logger } from '@config/logger';
import type { RequestHandler, Router } from 'express';

import { WishlistService } from './application/WishlistService';
import { MongoWishlistCatalogAdapter } from './infrastructure/catalog/wishlist-catalog.adapter';
import { MongoWishlistRepository } from './infrastructure/database/wishlist.repository';
import { createWishlistRoutes } from './presentation/routes/wishlist.routes';

export interface WishlistSharedDeps {
  logger: Logger;
  authMiddleware: RequestHandler;
  productRepository: {
    findById(id: string): Promise<unknown>;
  };
  variantRepository: {
    findById(id: string): Promise<unknown>;
    findBySku(sku: string): Promise<unknown>;
    findActiveByProduct(productId: string): Promise<unknown[]>;
  };
}

export function createWishlistDependencies(shared: WishlistSharedDeps): {
  wishlistService: WishlistService;
  wishlistRoutes: Router;
  wishlistRepository: MongoWishlistRepository;
} {
  const wishlistRepository = new MongoWishlistRepository(shared.logger);
  const catalog = new MongoWishlistCatalogAdapter(
    shared.productRepository as never,
    shared.variantRepository as never,
  );
  const wishlistService = new WishlistService(wishlistRepository, catalog, shared.logger);
  const wishlistRoutes = createWishlistRoutes({
    wishlistService,
    authMiddleware: shared.authMiddleware,
    logger: shared.logger,
  });
  return { wishlistService, wishlistRoutes, wishlistRepository };
}
