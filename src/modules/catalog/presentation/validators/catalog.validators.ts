import { validateBody, validateParams, validateQuery } from '@shared/validation/zod-validation';
import { z } from 'zod';

const titleSchema = z.string().trim().min(2).max(200);
const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const descriptionSchema = z.string().trim().min(10).max(10000);
const uuidSchema = z.string().uuid();
const priceMinorSchema = z.number().int().min(0).max(100000000);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);

const attrsSchema = z.record(z.string().trim().min(1).max(32), z.string().trim().min(1).max(64));

const mediaRefSchema = z.object({
  mediaId: z.string().min(1).max(120),
  key: z.string().min(1).max(300),
  url: z.string().url().max(1000),
  type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  altText: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).max(50),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  bytes: z.number().int().positive().max(5242880).optional(),
});

const seoSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
});

export const createProductSchema = z
  .object({
    title: titleSchema,
    slug: slugSchema.optional(),
    description: descriptionSchema,
    shortDescription: z.string().trim().max(500).optional(),
    categoryId: uuidSchema,
    brandId: uuidSchema.optional(),
    attrs: attrsSchema.optional(),
    media: z.array(mediaRefSchema).max(10).optional(),
    seo: seoSchema.optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    shortDescription: z.string().trim().max(500).optional(),
    categoryId: uuidSchema.optional(),
    brandId: uuidSchema.optional(),
    attrs: attrsSchema.optional(),
    media: z.array(mediaRefSchema).max(10).optional(),
    seo: seoSchema.optional(),
    version: z.number().int().nonnegative(),
  })
  .strict();

export const productListQuerySchema = z.object({
  category: z.string().max(120).optional(),
  brand: z.string().max(120).optional(),
  minPrice: z.coerce.number().min(0).max(100000000).optional(),
  maxPrice: z.coerce.number().min(0).max(100000000).optional(),
  search: z.string().trim().min(2).max(100).optional(),
  sort: z.enum(['price', '-price', 'createdAt', '-createdAt']).default('createdAt'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(2000).optional(),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1).max(200),
});

export const productIdParamSchema = z.object({
  id: uuidSchema,
});

export const createVariantSchema = z
  .object({
    sku: z.string().trim().min(3).max(64),
    barcode: z.string().trim().max(64).optional(),
    attrs: attrsSchema,
    dims: z
      .object({
        length: z.number().positive().max(100000).optional(),
        width: z.number().positive().max(100000).optional(),
        height: z.number().positive().max(100000).optional(),
        weight: z.number().positive().max(1000000).optional(),
      })
      .optional(),
    priceRef: z.object({ amountMinor: priceMinorSchema, currency: currencySchema }),
  })
  .strict();

export const updateVariantSchema = z
  .object({
    barcode: z.string().trim().max(64).optional(),
    dims: z
      .object({
        length: z.number().positive().max(100000).optional(),
        width: z.number().positive().max(100000).optional(),
        height: z.number().positive().max(100000).optional(),
        weight: z.number().positive().max(1000000).optional(),
      })
      .optional(),
    status: z.enum(['active', 'discontinued']).optional(),
    priceRef: z.object({ amountMinor: priceMinorSchema, currency: currencySchema }).optional(),
    version: z.number().int().nonnegative(),
  })
  .strict();

export const variantIdParamSchema = z.object({
  id: uuidSchema,
  variantId: uuidSchema,
});

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema.optional(),
    description: z.string().trim().max(2000).optional(),
    parentId: uuidSchema.optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

export const categorySlugParamSchema = z.object({
  slug: z.string().min(1).max(200),
});

export const createBrandSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema.optional(),
    description: z.string().trim().max(2000).optional(),
    logo: z.object({ key: z.string().min(1).max(300), url: z.string().url().max(1000) }).optional(),
  })
  .strict();

export const updateBrandSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    logo: z.object({ key: z.string().min(1).max(300), url: z.string().url().max(1000) }).optional(),
  })
  .strict();

export const uploadUrlSchema = z
  .object({
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().positive().max(5242880),
    ownerType: z.enum(['product', 'variant', 'category', 'brand']),
  })
  .strict();

export const validateCreateProduct = validateBody(createProductSchema);
export const validateUpdateProduct = validateBody(updateProductSchema);
export const validateProductListQuery = validateQuery(productListQuerySchema);
export const validateSlugParam = validateParams(slugParamSchema);
export const validateProductIdParam = validateParams(productIdParamSchema);
export const validateCreateVariant = validateBody(createVariantSchema);
export const validateUpdateVariant = validateBody(updateVariantSchema);
export const validateVariantIdParam = validateParams(variantIdParamSchema);
export const validateCreateCategory = validateBody(createCategorySchema);
export const validateUpdateCategory = validateBody(updateCategorySchema);
export const validateCategorySlugParam = validateParams(categorySlugParamSchema);
export const validateCreateBrand = validateBody(createBrandSchema);
export const validateUpdateBrand = validateBody(updateBrandSchema);
export const validateUploadUrl = validateBody(uploadUrlSchema);
