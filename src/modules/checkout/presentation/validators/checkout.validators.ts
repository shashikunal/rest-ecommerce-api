import { validateBody, validateParams, validateQuery } from '@shared/validation/zod-validation';
import { z } from 'zod';

const uuidSchema = z.string().uuid();

const addressSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1).max(32).optional().nullable(),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().min(1).max(200).optional().nullable(),
    city: z.string().trim().min(1).max(120),
    region: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(1).max(32),
    country: z.string().trim().length(2).toUpperCase(),
  })
  .strict();

export const createCheckoutSchema = z
  .object({
    shippingAddress: addressSchema,
    billingAddress: addressSchema.optional().nullable(),
    couponCode: z.string().trim().min(1).max(64).optional().nullable(),
    cartId: z.never().optional(),
    userId: z.never().optional(),
    ownerId: z.never().optional(),
    customerId: z.never().optional(),
    items: z.never().optional(),
    pricing: z.never().optional(),
    subtotal: z.never().optional(),
    total: z.never().optional(),
    grandTotal: z.never().optional(),
    discount: z.never().optional(),
    tax: z.never().optional(),
    shipping: z.never().optional(),
    price: z.never().optional(),
    reservations: z.never().optional(),
    status: z.never().optional(),
    version: z.never().optional(),
  })
  .strict();

export const checkoutIdParamSchema = z.object({
  id: uuidSchema,
});

export const checkoutListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(2000).optional(),
});

export const updateAddressSchema = z
  .object({
    shippingAddress: addressSchema,
    billingAddress: addressSchema.optional().nullable(),
    expectedVersion: z.number().int().nonnegative(),
    userId: z.never().optional(),
    items: z.never().optional(),
    pricing: z.never().optional(),
  })
  .strict();

export const cancelCheckoutSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export const sweepCheckoutSchema = z
  .object({
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export const validateCreateCheckout = validateBody(createCheckoutSchema);
export const validateCheckoutIdParam = validateParams(checkoutIdParamSchema);
export const validateCheckoutListQuery = validateQuery(checkoutListQuerySchema);
export const validateUpdateAddress = validateBody(updateAddressSchema);
export const validateCancelCheckout = validateBody(cancelCheckoutSchema);
export const validateSweepCheckout = validateBody(sweepCheckoutSchema);
