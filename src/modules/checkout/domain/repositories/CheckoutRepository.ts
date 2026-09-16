import type { Checkout, CheckoutReservationRef, CheckoutStatus } from '../entities/Checkout';

export interface CheckoutListOptions {
  limit: number;
  cursor?: string;
}

export interface CheckoutListResult {
  checkouts: Checkout[];
  nextCursor: string | null;
}

export interface CheckoutRepository {
  create(checkout: Checkout): Promise<void>;
  findById(id: string): Promise<Checkout | null>;
  findByUserAndKey(userId: string, idempotencyKey: string): Promise<Checkout | null>;
  listByUser(userId: string, options: CheckoutListOptions): Promise<CheckoutListResult>;
  transition(
    id: string,
    from: CheckoutStatus[],
    to: CheckoutStatus,
    expectedVersion?: number,
  ): Promise<Checkout | null>;
  setReservations(
    id: string,
    reservations: CheckoutReservationRef[],
    expectedVersion: number,
  ): Promise<Checkout | null>;
  updateAddress(
    id: string,
    shipping: Checkout['shippingAddress'],
    billing: Checkout['billingAddress'],
    expectedVersion: number,
  ): Promise<Checkout | null>;
  markFailed(id: string, reason: string, expectedVersion?: number): Promise<Checkout | null>;
  markCompleted(id: string, orderId: string, expectedVersion?: number): Promise<Checkout | null>;
  findActiveExpired(now: Date, limit: number): Promise<Checkout[]>;
}
