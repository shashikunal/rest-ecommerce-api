import type { Logger } from '@config/logger';
import { Router, type RequestHandler } from 'express';

import type { CartService } from '../../application/CartService';
import { idempotencyMiddleware } from '../../infrastructure/idempotency/redis-idempotency';
import { CartController } from '../controllers/cart.controller';
import {
  validateAddCartItem,
  validateCartItemIdParam,
  validateUpdateCartItem,
} from '../validators/cart.validators';

export interface CartRouteDeps {
  cartService: CartService;
  authMiddleware: RequestHandler;
  logger: Logger;
}

export function createCartRoutes(deps: CartRouteDeps): Router {
  const router = Router();
  const controller = new CartController(deps.cartService);
  const auth = deps.authMiddleware;
  const idem = idempotencyMiddleware(deps.logger, 'cart');

  router.get('/cart', auth, controller.getCart);
  router.post('/cart/items', auth, idem, validateAddCartItem, controller.addItem);
  router.patch(
    '/cart/items/:itemId',
    auth,
    idem,
    validateCartItemIdParam,
    validateUpdateCartItem,
    controller.updateItem,
  );
  router.delete('/cart/items/:itemId', auth, idem, validateCartItemIdParam, controller.removeItem);
  router.delete('/cart', auth, idem, controller.clearCart);

  return router;
}
