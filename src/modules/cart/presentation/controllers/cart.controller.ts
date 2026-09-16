import type { AuthRequest } from '@modules/auth/middleware/auth.middleware';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler, sendSuccessResponse } from '@shared/http/response';
import type { Response } from 'express';

import type { CartService } from '../../application/CartService';
import { normalizeAddInput, normalizeUpdateInput } from '../validators/cart.validators';

function requireUserId(req: AuthRequest): string {
  if (!req.user) throw AppErrorFactory.unauthorized('Authentication required');
  return req.user.id;
}

export class CartController {
  constructor(private readonly carts: CartService) {}

  getCart = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const view = await this.carts.getCart(requireUserId(req), req.correlationId);
    sendSuccessResponse(res, view);
  });

  addItem = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const input = normalizeAddInput(req.body);
    const { view, created } = await this.carts.addItem(
      requireUserId(req),
      input,
      req.correlationId,
    );
    sendSuccessResponse(res, view, created ? 201 : 200);
  });

  updateItem = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const input = normalizeUpdateInput(req.body);
    const view = await this.carts.updateItem(
      requireUserId(req),
      req.params.itemId as string,
      input,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  removeItem = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const expectedVersion =
      typeof req.query.version === 'string' ? Number(req.query.version) : undefined;
    const view = await this.carts.removeItem(
      requireUserId(req),
      req.params.itemId as string,
      Number.isInteger(expectedVersion) ? (expectedVersion as number) : undefined,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  clearCart = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const view = await this.carts.clearCart(
      requireUserId(req),
      (req.body as { expectedVersion?: number }).expectedVersion,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });
}
