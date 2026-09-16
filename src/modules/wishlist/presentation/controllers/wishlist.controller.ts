import type { AuthRequest } from '@modules/auth/middleware/auth.middleware';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler, sendSuccessResponse } from '@shared/http/response';
import type { Response } from 'express';

import type { WishlistService } from '../../application/WishlistService';

function requireUserId(req: AuthRequest): string {
  if (!req.user) throw AppErrorFactory.unauthorized('Authentication required');
  return req.user.id;
}

export class WishlistController {
  constructor(private readonly wishlists: WishlistService) {}

  list = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const view = await this.wishlists.list(
      requireUserId(req),
      Number(req.query.limit ?? 20),
      req.query.cursor as string | undefined,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  addItem = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const body = req.body as {
      sku?: string;
      productId?: string;
      variantId?: string;
      skuId?: string;
    };
    const { view, created } = await this.wishlists.addItem(
      requireUserId(req),
      { sku: body.sku, productId: body.productId, variantId: body.variantId ?? body.skuId },
      req.correlationId,
    );
    sendSuccessResponse(res, view, created ? 201 : 200);
  });

  removeItem = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    await this.wishlists.removeItem(
      requireUserId(req),
      req.params.itemId as string,
      req.correlationId,
    );
    res.status(204).send();
  });

  check = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await this.wishlists.check(
      requireUserId(req),
      req.query.productId as string,
      req.query.variantId as string | undefined,
    );
    sendSuccessResponse(res, result);
  });
}
