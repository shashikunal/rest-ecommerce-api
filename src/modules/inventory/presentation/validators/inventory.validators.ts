import { validateBody, validateParams, validateQuery } from '@shared/validation/zod-validation';
import { z } from 'zod';

const skuSchema = z.string().trim().min(1).max(64);
const uuidSchema = z.string().uuid();
const idOrSkuSchema = z.string().trim().min(1).max(64);
const referenceTypeSchema = z.string().trim().min(1).max(64);
const referenceIdSchema = z.string().trim().min(1).max(128);
const idempotencyKeySchema = z.string().trim().min(8).max(128);

const adjustmentReasonSchema = z.enum([
  'RECEIPT',
  'DAMAGE',
  'LOSS',
  'RETURN',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'CYCLE_COUNT',
  'MANUAL_CORRECTION',
]);

const stockStatusSchema = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']);

export const initInventorySchema = z
  .object({
    sku: skuSchema.optional(),
    productId: uuidSchema.optional(),
    variantId: uuidSchema.optional(),
    initialOnHand: z.number().int().min(0).max(1000000).optional(),
    lowStockThreshold: z.number().int().min(0).max(1000000).optional(),
    onHand: z.never().optional(),
    reserved: z.never().optional(),
    sold: z.never().optional(),
    available: z.never().optional(),
    version: z.never().optional(),
    status: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.sku && !(value.productId && value.variantId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either sku or productId + variantId is required',
      });
    }
  });

export const adjustInventorySchema = z
  .object({
    sku: skuSchema.optional(),
    inventoryId: uuidSchema.optional(),
    delta: z.number().int().min(-1000000).max(1000000),
    reason: adjustmentReasonSchema,
    referenceType: referenceTypeSchema.optional(),
    referenceId: referenceIdSchema.optional(),
    idempotencyKey: idempotencyKeySchema.optional(),
    onHand: z.never().optional(),
    reserved: z.never().optional(),
    sold: z.never().optional(),
    available: z.never().optional(),
    version: z.never().optional(),
    status: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.delta === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'delta must be non-zero' });
    }
    if (!value.sku && !value.inventoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either sku or inventoryId is required',
      });
    }
  });

export const reserveStockSchema = z
  .object({
    sku: skuSchema,
    quantity: z.number().int().min(1).max(1000),
    referenceType: referenceTypeSchema,
    referenceId: referenceIdSchema,
    idempotencyKey: idempotencyKeySchema,
    ttlSeconds: z.number().int().min(60).max(3600).optional(),
    status: z.never().optional(),
    expiresAt: z.never().optional(),
    version: z.never().optional(),
  })
  .strict();

export const releaseReservationSchema = z
  .object({
    reason: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const inventoryListQuerySchema = z.object({
  sku: skuSchema.optional(),
  status: stockStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(2000).optional(),
});

export const availabilityQuerySchema = z.object({
  sku: skuSchema,
});

export const inventoryIdParamSchema = z.object({
  id: idOrSkuSchema,
});

export const reservationIdParamSchema = z.object({
  id: uuidSchema,
});

export const movementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(2000).optional(),
});

export const sweepSchema = z
  .object({
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export const validateInitInventory = validateBody(initInventorySchema);
export const validateAdjustInventory = validateBody(adjustInventorySchema);
export const validateReserveStock = validateBody(reserveStockSchema);
export const validateReleaseReservation = validateBody(releaseReservationSchema);
export const validateSweep = validateBody(sweepSchema);
export const validateInventoryListQuery = validateQuery(inventoryListQuerySchema);
export const validateAvailabilityQuery = validateQuery(availabilityQuerySchema);
export const validateMovementsQuery = validateQuery(movementsQuerySchema);
export const validateInventoryIdParam = validateParams(inventoryIdParamSchema);
export const validateReservationIdParam = validateParams(reservationIdParamSchema);
