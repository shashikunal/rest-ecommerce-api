import { validateBody, validateParams } from '@shared/validation/zod-validation';
import { z } from 'zod';

const skuSchema = z.string().trim().min(1).max(64);
const uuidSchema = z.string().uuid();
const qtySchema = z.number().int().min(1).max(50);
const qtyCoerced = z.coerce.number().int().min(1).max(50);

export const addCartItemSchema = z
  .object({
    sku: skuSchema.optional(),
    productId: uuidSchema.optional(),
    variantId: uuidSchema.optional(),
    skuId: uuidSchema.optional(),
    qty: qtyCoerced.optional(),
    quantity: qtyCoerced.optional(),
    expectedVersion: z.number().int().nonnegative().optional(),
    price: z.never().optional(),
    unitPrice: z.never().optional(),
    unitMinor: z.never().optional(),
    currency: z.never().optional(),
    total: z.never().optional(),
    title: z.never().optional(),
    name: z.never().optional(),
    userId: z.never().optional(),
    ownerId: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.qty !== undefined && value.quantity !== undefined && value.qty !== value.quantity) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'qty and quantity must match' });
    }
    if (!value.sku && !value.productId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Either sku or productId is required' });
    }
  });

export const updateCartItemSchema = z
  .object({
    qty: qtyCoerced.optional(),
    quantity: qtyCoerced.optional(),
    expectedVersion: z.number().int().nonnegative(),
    price: z.never().optional(),
    userId: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.qty === undefined && value.quantity === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'qty or quantity is required' });
    }
    if (value.qty !== undefined && value.quantity !== undefined && value.qty !== value.quantity) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'qty and quantity must match' });
    }
  });

export const cartItemIdParamSchema = z.object({
  itemId: uuidSchema,
});

export const clearCartSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export function normalizeAddInput(body: {
  sku?: string;
  productId?: string;
  variantId?: string;
  skuId?: string;
  qty?: number;
  quantity?: number;
  expectedVersion?: number;
}): {
  sku?: string;
  productId?: string;
  variantId?: string;
  quantity: number;
  expectedVersion?: number;
} {
  const quantity = (body.quantity ?? body.qty) as number;
  if (!Number.isInteger(quantity)) throw new Error('INVALID_QTY');
  return {
    sku: body.sku,
    productId: body.productId,
    variantId: body.variantId ?? body.skuId,
    quantity,
    expectedVersion: body.expectedVersion,
  };
}

export function normalizeUpdateInput(body: {
  qty?: number;
  quantity?: number;
  expectedVersion: number;
}): { quantity: number; expectedVersion: number } {
  const quantity = (body.quantity ?? body.qty) as number;
  return { quantity, expectedVersion: body.expectedVersion };
}

void qtySchema;

export const validateAddCartItem = validateBody(addCartItemSchema);
export const validateUpdateCartItem = validateBody(updateCartItemSchema);
export const validateCartItemIdParam = validateParams(cartItemIdParamSchema);
