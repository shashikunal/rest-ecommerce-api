import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class ProductNotFoundError extends AppError {
  constructor(message = 'Product not found', correlationId?: string) {
    super({ code: ERROR_CODES.PRODUCT_NOT_FOUND, message, correlationId });
    this.name = 'ProductNotFoundError';
  }
}

export class VariantNotFoundError extends AppError {
  constructor(message = 'Variant not found', correlationId?: string) {
    super({ code: ERROR_CODES.VARIANT_NOT_FOUND, message, correlationId });
    this.name = 'VariantNotFoundError';
  }
}

export class CategoryNotFoundError extends AppError {
  constructor(message = 'Category not found', correlationId?: string) {
    super({ code: ERROR_CODES.CATEGORY_NOT_FOUND, message, correlationId });
    this.name = 'CategoryNotFoundError';
  }
}

export class BrandNotFoundError extends AppError {
  constructor(message = 'Brand not found', correlationId?: string) {
    super({ code: ERROR_CODES.BRAND_NOT_FOUND, message, correlationId });
    this.name = 'BrandNotFoundError';
  }
}

export class SkuExistsError extends AppError {
  constructor(sku: string, correlationId?: string) {
    super({ code: ERROR_CODES.SKU_EXISTS, message: `SKU already exists: ${sku}`, correlationId });
    this.name = 'SkuExistsError';
  }
}

export class SlugExistsError extends AppError {
  constructor(slug: string, correlationId?: string) {
    super({
      code: ERROR_CODES.SLUG_EXISTS,
      message: `Slug already exists: ${slug}`,
      correlationId,
    });
    this.name = 'SlugExistsError';
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string, correlationId?: string) {
    super({ code: ERROR_CODES.INVALID_TRANSITION, message, correlationId });
    this.name = 'InvalidTransitionError';
  }
}

export class CategoryInUseError extends AppError {
  constructor(message: string, correlationId?: string) {
    super({ code: ERROR_CODES.CATEGORY_IN_USE, message, correlationId });
    this.name = 'CategoryInUseError';
  }
}

export class InvalidCategoryError extends AppError {
  constructor(message: string, correlationId?: string) {
    super({ code: ERROR_CODES.INVALID_CATEGORY, message, correlationId });
    this.name = 'InvalidCategoryError';
  }
}

export class ProductNotPublishableError extends AppError {
  constructor(message: string, correlationId?: string) {
    super({ code: ERROR_CODES.PRODUCT_NOT_PUBLISHABLE, message, correlationId });
    this.name = 'ProductNotPublishableError';
  }
}
