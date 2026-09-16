import { validateBody, validateParams, validateQuery } from '@shared/validation/zod-validation';
import { z } from 'zod';

const skuSchema = z.string().trim().min(1).max(64);
const uuidSchema = z.string().uuid();

export const addWishlistItemSchema = z
  .object({
    sku: skuSchema.optional(),
    productId: uuidSchema.optional(),
    variantId: uuidSchema.optional(),
    skuId: uuidSchema.optional(),
    userId: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.sku && !value.productId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Either sku or productId is required' });
    }
  });

export const wishlistItemIdParamSchema = z.object({
  itemId: uuidSchema,
});

export const wishlistListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(2000).optional(),
});

export const wishlistCheckQuerySchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
});

export const validateAddWishlistItem = validateBody(addWishlistItemSchema);
export const validateWishlistItemIdParam = validateParams(wishlistItemIdParamSchema);
export const validateWishlistListQuery = validateQuery(wishlistListQuerySchema);
export const validateWishlistCheckQuery = validateQuery(wishlistCheckQuerySchema);
