import type { AuthRequest } from '@modules/auth/middleware/auth.middleware';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler, sendSuccessResponse } from '@shared/http/response';
import type { Response } from 'express';

import type {
  AdjustInventoryInput,
  EnsureInventoryInput,
  InventoryActor,
  InventoryService,
  ReserveInput,
} from '../../application/InventoryService';
import type { AdjustmentReason, StockStatus } from '../../domain/entities/Inventory';

function requireUser(req: AuthRequest): { id: string; roles: string[] } {
  if (!req.user) throw AppErrorFactory.unauthorized('Authentication required');
  return { id: req.user.id, roles: req.user.roles ?? [] };
}

function toActor(user: { id: string; roles: string[] }): InventoryActor {
  const roles = user.roles.map((r) => r.toLowerCase());
  if (roles.includes('system')) return { type: 'system', id: user.id };
  if (roles.includes('admin')) return { type: 'admin', id: user.id };
  return { type: 'staff', id: user.id };
}

export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  getAvailability = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const view = await this.inventory.getAvailability(req.query.sku as string, req.correlationId);
    sendSuccessResponse(res, view);
  });

  list = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    requireUser(req);
    const view = await this.inventory.listRecords(
      {
        sku: req.query.sku as string | undefined,
        status: req.query.status as StockStatus | undefined,
        limit: Number(req.query.limit ?? 20),
        cursor: req.query.cursor as string | undefined,
      },
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  getOne = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    requireUser(req);
    const view = await this.inventory.getRecord(req.params.id as string, req.correlationId);
    sendSuccessResponse(res, view);
  });

  init = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = toActor(requireUser(req));
    const { view, created } = await this.inventory.ensureInventory(
      req.body as EnsureInventoryInput,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, view, created ? 201 : 200);
  });

  adjust = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = toActor(requireUser(req));
    const body = req.body as Omit<AdjustInventoryInput, 'reason'> & { reason: string };
    const view = await this.inventory.adjust(
      { ...body, reason: body.reason as AdjustmentReason },
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  movements = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    requireUser(req);
    const view = await this.inventory.listMovements(
      req.params.id as string,
      {
        limit: Number(req.query.limit ?? 20),
        cursor: req.query.cursor as string | undefined,
      },
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  reserve = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = toActor(requireUser(req));
    const { reservation, inventory } = await this.inventory.reserve(
      req.body as ReserveInput,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, { reservation, inventory }, 201);
  });

  getReservation = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    requireUser(req);
    const view = await this.inventory.getReservation(req.params.id as string, req.correlationId);
    sendSuccessResponse(res, view);
  });

  release = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = toActor(requireUser(req));
    const { reservation, inventory } = await this.inventory.release(
      req.params.id as string,
      actor,
      { reason: (req.body as { reason?: string }).reason },
      req.correlationId,
    );
    sendSuccessResponse(res, { reservation, inventory });
  });

  confirm = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = toActor(requireUser(req));
    const { reservation, inventory } = await this.inventory.confirm(
      req.params.id as string,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, { reservation, inventory });
  });

  sweep = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = toActor(requireUser(req));
    const result = await this.inventory.expireReservations(
      { limit: (req.body as { limit?: number }).limit },
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, result);
  });
}
