import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class CartNotFoundError extends AppError {
  constructor(message = 'Cart not found', correlationId?: string) {
    super({ code: ERROR_CODES.NOT_FOUND, message, correlationId });
    this.name = 'CartNotFoundError';
  }
}

export class CartItemNotFoundError extends AppError {
  constructor(message = 'Cart item not found', correlationId?: string) {
    super({ code: ERROR_CODES.NOT_FOUND, message, correlationId });
    this.name = 'CartItemNotFoundError';
  }
}

export class CartStaleError extends AppError {
  constructor(message = 'Cart was modified by another request', correlationId?: string) {
    super({ code: ERROR_CODES.CONCURRENT_UPDATE, message, correlationId });
    this.name = 'CartStaleError';
  }
}

export class InvalidQuantityError extends AppError {
  constructor(message = 'Quantity must be an integer between 1 and 50', correlationId?: string) {
    super({ code: ERROR_CODES.VALIDATION_ERROR, message, correlationId });
    this.name = 'InvalidQuantityError';
  }
}

export class SkuUnavailableError extends AppError {
  constructor(message = 'Product variant is not available', correlationId?: string) {
    super({ code: ERROR_CODES.UNPROCESSABLE, message, correlationId });
    this.name = 'SkuUnavailableError';
  }
}

export class CartLimitError extends AppError {
  constructor(message = 'Cart line limit exceeded', correlationId?: string) {
    super({ code: ERROR_CODES.UNPROCESSABLE, message, correlationId });
    this.name = 'CartLimitError';
  }
}
