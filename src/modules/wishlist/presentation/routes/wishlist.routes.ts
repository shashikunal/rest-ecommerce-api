import type { Logger } from '@config/logger';
import { Router, type RequestHandler } from 'express';

import { idempotencyMiddleware } from '../../../cart/infrastructure/idempotency/redis-idempotency';
import type { WishlistService } from '../../application/WishlistService';
import { WishlistController } from '../controllers/wishlist.controller';
import {
  validateAddWishlistItem,
  validateWishlistCheckQuery,
  validateWishlistItemIdParam,
  validateWishlistListQuery,
} from '../validators/wishlist.validators';

export interface WishlistRouteDeps {
  wishlistService: WishlistService;
  authMiddleware: RequestHandler;
  logger: Logger;
}

export function createWishlistRoutes(deps: WishlistRouteDeps): Router {
  const router = Router();
  const controller = new WishlistController(deps.wishlistService);
  const auth = deps.authMiddleware;
  const idem = idempotencyMiddleware(deps.logger, 'wishlist');

  router.get('/wishlist', auth, validateWishlistListQuery, controller.list);
  router.post('/wishlist/items', auth, idem, validateAddWishlistItem, controller.addItem);
  router.get('/wishlist/check', auth, validateWishlistCheckQuery, controller.check);
  router.delete(
    '/wishlist/items/:itemId',
    auth,
    idem,
    validateWishlistItemIdParam,
    controller.removeItem,
  );

  return router;
}
