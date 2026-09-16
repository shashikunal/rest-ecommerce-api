import { createHash } from 'crypto';

import type { AuthRequest } from '@modules/auth/middleware/auth.middleware';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler, sendSuccessResponse } from '@shared/http/response';
import type { Response } from 'express';

import type { CheckoutService } from '../../application/CheckoutService';
import type { AddressInput } from '../../domain/ports/CheckoutPorts';

function requireUserId(req: AuthRequest): string {
  if (!req.user) throw AppErrorFactory.unauthorized('Authentication required');
  return req.user.id;
}

function requireIdempotencyKey(req: AuthRequest): string {
  const raw = req.headers['idempotency-key'];
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (!key || typeof key !== 'string' || key.length === 0) {
    throw AppErrorFactory.validation('Idempotency-Key', 'Idempotency-Key header is required');
  }
  return key;
}

function requestHash(req: AuthRequest): string {
  return createHash('sha256')
    .update(JSON.stringify({ method: req.method, path: req.path, body: req.body ?? null }))
    .digest('hex');
}

export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  create = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const body = req.body as {
      shippingAddress: AddressInput;
      billingAddress?: AddressInput | null;
      couponCode?: string | null;
    };
    const { view, created } = await this.checkout.createCheckout(
      userId,
      {
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress ?? null,
        couponCode: body.couponCode ?? null,
        idempotencyKey,
        reqHash: requestHash(req),
      },
      req.correlationId,
    );
    sendSuccessResponse(res, view, created ? 201 : 200);
  });

  list = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const view = await this.checkout.listCheckouts(
      requireUserId(req),
      {
        limit: Number(req.query.limit ?? 20),
        cursor: req.query.cursor as string | undefined,
      },
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  getOne = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const view = await this.checkout.getCheckout(
      requireUserId(req),
      req.params.id as string,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  validate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { view, ok, issues } = await this.checkout.validateCheckout(
      requireUserId(req),
      req.params.id as string,
      req.correlationId,
    );
    sendSuccessResponse(res, { checkout: view, ok, issues }, ok ? 200 : 422);
  });

  reserve = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const view = await this.checkout.reserveCheckout(
      requireUserId(req),
      req.params.id as string,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  updateAddress = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const body = req.body as {
      shippingAddress: AddressInput;
      billingAddress?: AddressInput | null;
      expectedVersion: number;
    };
    const view = await this.checkout.updateAddress(
      requireUserId(req),
      req.params.id as string,
      {
        shipping: body.shippingAddress,
        billing: body.billingAddress ?? null,
        expectedVersion: body.expectedVersion,
      },
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  cancel = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { view } = await this.checkout.cancelCheckout(
      requireUserId(req),
      req.params.id as string,
      (req.body as { expectedVersion?: number }).expectedVersion,
      req.correlationId,
    );
    sendSuccessResponse(res, view);
  });

  sweep = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    requireUserId(req);
    const result = await this.checkout.expireCheckouts(
      { limit: (req.body as { limit?: number }).limit },
      req.correlationId,
    );
    sendSuccessResponse(res, result);
  });
}
