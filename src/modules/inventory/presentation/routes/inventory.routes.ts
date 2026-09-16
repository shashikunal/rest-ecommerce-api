import type { Logger } from '@config/logger';
import { requirePermission, requireRole } from '@shared/authorization/authorization';
import { Router, type RequestHandler } from 'express';

import { idempotencyMiddleware } from '../../../cart/infrastructure/idempotency/redis-idempotency';
import type { InventoryService } from '../../application/InventoryService';
import { InventoryController } from '../controllers/inventory.controller';
import {
  validateAdjustInventory,
  validateAvailabilityQuery,
  validateInitInventory,
  validateInventoryIdParam,
  validateInventoryListQuery,
  validateMovementsQuery,
  validateReleaseReservation,
  validateReservationIdParam,
  validateReserveStock,
  validateSweep,
} from '../validators/inventory.validators';

export interface InventoryRouteDeps {
  inventoryService: InventoryService;
  authMiddleware: RequestHandler;
  logger: Logger;
}

export function createInventoryRoutes(deps: InventoryRouteDeps): Router {
  const router = Router();
  const controller = new InventoryController(deps.inventoryService);
  const auth = deps.authMiddleware;
  const canAdjust = requirePermission('inventory:adjust');
  const idem = idempotencyMiddleware(deps.logger, 'inventory');

  router.get('/inventory/availability', validateAvailabilityQuery, controller.getAvailability);

  router.get('/inventory', auth, canAdjust, validateInventoryListQuery, controller.list);
  router.post('/inventory', auth, canAdjust, idem, validateInitInventory, controller.init);
  router.post(
    '/inventory/adjust',
    auth,
    canAdjust,
    idem,
    validateAdjustInventory,
    controller.adjust,
  );
  router.get('/inventory/:id', auth, canAdjust, validateInventoryIdParam, controller.getOne);
  router.get(
    '/inventory/:id/movements',
    auth,
    canAdjust,
    validateInventoryIdParam,
    validateMovementsQuery,
    controller.movements,
  );

  router.post('/inventory/reservations', auth, canAdjust, validateReserveStock, controller.reserve);
  router.post(
    '/inventory/reservations/expire-sweep',
    auth,
    requireRole('ADMIN', 'SYSTEM'),
    validateSweep,
    controller.sweep,
  );
  router.get(
    '/inventory/reservations/:id',
    auth,
    canAdjust,
    validateReservationIdParam,
    controller.getReservation,
  );
  router.post(
    '/inventory/reservations/:id/release',
    auth,
    canAdjust,
    validateReservationIdParam,
    validateReleaseReservation,
    controller.release,
  );
  router.post(
    '/inventory/reservations/:id/confirm',
    auth,
    canAdjust,
    validateReservationIdParam,
    controller.confirm,
  );

  return router;
}
