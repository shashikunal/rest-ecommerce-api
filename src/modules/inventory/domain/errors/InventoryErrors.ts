import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

export class InventoryNotFoundError extends AppError {
  constructor(message = 'Inventory record not found', correlationId?: string) {
    super({ code: ERROR_CODES.INVENTORY_NOT_FOUND, message, correlationId });
    this.name = 'InventoryNotFoundError';
  }
}

export class InventoryExistsError extends AppError {
  constructor(sku: string, correlationId?: string) {
    super({
      code: ERROR_CODES.CONFLICT,
      message: `Inventory already exists for SKU: ${sku}`,
      correlationId,
    });
    this.name = 'InventoryExistsError';
  }
}

export class InsufficientStockError extends AppError {
  constructor(message = 'Insufficient stock available', correlationId?: string) {
    super({ code: ERROR_CODES.INSUFFICIENT_STOCK, message, correlationId });
    this.name = 'InsufficientStockError';
  }
}

export class ReservationNotFoundError extends AppError {
  constructor(message = 'Reservation not found', correlationId?: string) {
    super({ code: ERROR_CODES.RESERVATION_NOT_FOUND, message, correlationId });
    this.name = 'ReservationNotFoundError';
  }
}

export class InvalidReservationStateError extends AppError {
  constructor(message = 'Invalid reservation state transition', correlationId?: string) {
    super({ code: ERROR_CODES.INVALID_RESERVATION_STATE, message, correlationId });
    this.name = 'InvalidReservationStateError';
  }
}

export class InvalidQuantityError extends AppError {
  constructor(message = 'Invalid inventory quantity', correlationId?: string) {
    super({ code: ERROR_CODES.VALIDATION_ERROR, message, correlationId });
    this.name = 'InventoryInvalidQuantityError';
  }
}

export class AdjustmentRejectedError extends AppError {
  constructor(message = 'Inventory adjustment rejected', correlationId?: string) {
    super({ code: ERROR_CODES.UNPROCESSABLE, message, correlationId });
    this.name = 'AdjustmentRejectedError';
  }
}
