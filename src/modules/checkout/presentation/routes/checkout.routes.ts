import type { Logger } from '@config/logger';
import { requireRole } from '@shared/authorization/authorization';
import { Router, type RequestHandler } from 'express';

import { idempotencyMiddleware } from '../../../cart/infrastructure/idempotency/redis-idempotency';
import type { CheckoutService } from '../../application/CheckoutService';
import { CheckoutController } from '../controllers/checkout.controller';
import {
  validateCancelCheckout,
  validateCheckoutIdParam,
  validateCheckoutListQuery,
  validateCreateCheckout,
  validateSweepCheckout,
  validateUpdateAddress,
} from '../validators/checkout.validators';

export interface CheckoutRouteDeps {
  checkoutService: CheckoutService;
  authMiddleware: RequestHandler;
  logger: Logger;
}

export function createCheckoutRoutes(deps: CheckoutRouteDeps): Router {
  const router = Router();
  const controller = new CheckoutController(deps.checkoutService);
  const auth = deps.authMiddleware;
  const idem = idempotencyMiddleware(deps.logger, 'checkout');

  router.post('/checkout', auth, idem, validateCreateCheckout, controller.create);
  router.get('/checkout', auth, validateCheckoutListQuery, controller.list);
  router.post(
    '/checkout/expire-sweep',
    auth,
    requireRole('ADMIN', 'SYSTEM'),
    validateSweepCheckout,
    controller.sweep,
  );
  router.get('/checkout/:id', auth, validateCheckoutIdParam, controller.getOne);
  router.post('/checkout/:id/validate', auth, idem, validateCheckoutIdParam, controller.validate);
  router.post('/checkout/:id/reserve', auth, idem, validateCheckoutIdParam, controller.reserve);
  router.patch(
    '/checkout/:id/address',
    auth,
    idem,
    validateCheckoutIdParam,
    validateUpdateAddress,
    controller.updateAddress,
  );
  router.post(
    '/checkout/:id/cancel',
    auth,
    idem,
    validateCheckoutIdParam,
    validateCancelCheckout,
    controller.cancel,
  );

  return router;
}
