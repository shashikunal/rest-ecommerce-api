import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class CheckoutNotFoundError extends AppError {
  constructor(message = 'Checkout not found', correlationId?: string) {
    super({ code: ERROR_CODES.CHECKOUT_NOT_FOUND, message, correlationId });
    this.name = 'CheckoutNotFoundError';
  }
}

export class CheckoutConflictError extends AppError {
  constructor(message = 'Checkout conflict', correlationId?: string) {
    super({ code: ERROR_CODES.CHECKOUT_CONFLICT, message, correlationId });
    this.name = 'CheckoutConflictError';
  }
}

export class CheckoutExpiredError extends AppError {
  constructor(message = 'Checkout has expired', correlationId?: string) {
    super({ code: ERROR_CODES.CHECKOUT_EXPIRED, message, correlationId });
    this.name = 'CheckoutExpiredError';
  }
}

export class CartEmptyError extends AppError {
  constructor(message = 'Cart is empty', correlationId?: string) {
    super({ code: ERROR_CODES.CART_EMPTY, message, correlationId });
    this.name = 'CartEmptyError';
  }
}

export class CartChangedError extends AppError {
  constructor(message = 'Cart changed after checkout started', correlationId?: string) {
    super({ code: ERROR_CODES.CART_CHANGED, message, correlationId });
    this.name = 'CartChangedError';
  }
}

export class PriceChangedError extends AppError {
  constructor(message = 'Price changed since checkout snapshot', correlationId?: string) {
    super({ code: ERROR_CODES.PRICE_CHANGED, message, correlationId });
    this.name = 'PriceChangedError';
  }
}

export class ItemUnavailableError extends AppError {
  constructor(message = 'Item is no longer available', correlationId?: string) {
    super({ code: ERROR_CODES.ITEM_UNAVAILABLE, message, correlationId });
    this.name = 'ItemUnavailableError';
  }
}
