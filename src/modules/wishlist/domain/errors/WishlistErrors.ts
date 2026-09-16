import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class WishlistItemNotFoundError extends AppError {
  constructor(message = 'Wishlist item not found', correlationId?: string) {
    super({ code: ERROR_CODES.NOT_FOUND, message, correlationId });
    this.name = 'WishlistItemNotFoundError';
  }
}

export class WishlistLimitError extends AppError {
  constructor(message = 'Wishlist item limit exceeded', correlationId?: string) {
    super({ code: ERROR_CODES.UNPROCESSABLE, message, correlationId });
    this.name = 'WishlistLimitError';
  }
}

export class WishlistStaleError extends AppError {
  constructor(message = 'Wishlist was modified by another request', correlationId?: string) {
    super({ code: ERROR_CODES.CONCURRENT_UPDATE, message, correlationId });
    this.name = 'WishlistStaleError';
  }
}
