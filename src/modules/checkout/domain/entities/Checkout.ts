export type CheckoutStatus =
  'priced' | 'reserved' | 'ready' | 'completed' | 'failed' | 'expired' | 'cancelled';

export interface CheckoutAddress {
  readonly fullName: string;
  readonly phone: string | null;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly country: string;
}

export interface CheckoutItem {
  readonly productId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly title: string;
  readonly variantLabel: string | null;
  readonly quantity: number;
  readonly unitMinor: number;
  readonly currency: string;
  readonly lineTotalMinor: number;
}

export interface PricingSnapshot {
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly shippingMinor: number;
  readonly taxMinor: number;
  readonly grandTotalMinor: number;
  readonly currency: string;
  readonly couponCode: string | null;
}

export interface CheckoutReservationRef {
  readonly reservationId: string;
  readonly sku: string;
  readonly quantity: number;
}

export interface CustomerSnapshot {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
}

export interface Checkout {
  readonly id: string;
  readonly userId: string;
  readonly cartId: string;
  readonly cartVersion: number;
  readonly status: CheckoutStatus;
  readonly items: CheckoutItem[];
  readonly shippingAddress: CheckoutAddress;
  readonly billingAddress: CheckoutAddress;
  readonly pricing: PricingSnapshot;
  readonly currency: string;
  readonly customer: CustomerSnapshot;
  readonly reservations: CheckoutReservationRef[];
  readonly idempotencyKey: string | null;
  readonly reqHash: string | null;
  readonly failReason: string | null;
  readonly orderId: string | null;
  readonly version: number;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const CHECKOUT_STATUSES: CheckoutStatus[] = [
  'priced',
  'reserved',
  'ready',
  'completed',
  'failed',
  'expired',
  'cancelled',
];

export const ACTIVE_CHECKOUT_STATUSES: CheckoutStatus[] = ['priced', 'reserved', 'ready'];
export const TERMINAL_CHECKOUT_STATUSES: CheckoutStatus[] = [
  'completed',
  'failed',
  'expired',
  'cancelled',
];

const ALLOWED_TRANSITIONS: Record<CheckoutStatus, CheckoutStatus[]> = {
  priced: ['reserved', 'failed', 'expired', 'cancelled'],
  reserved: ['ready', 'failed', 'expired', 'cancelled'],
  ready: ['completed', 'failed', 'expired', 'cancelled'],
  completed: [],
  failed: [],
  expired: [],
  cancelled: [],
};

export function canTransitionCheckoutStatus(from: CheckoutStatus, to: CheckoutStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminalCheckoutStatus(status: CheckoutStatus): boolean {
  return TERMINAL_CHECKOUT_STATUSES.includes(status);
}

export function priceLineTotal(quantity: number, unitMinor: number): number {
  return quantity * unitMinor;
}

export function sumLineTotals(items: Array<{ quantity: number; unitMinor: number }>): number {
  return items.reduce((sum, item) => sum + priceLineTotal(item.quantity, item.unitMinor), 0);
}

export const CHECKOUT_TTL_SECONDS = 1800;
export const MAX_CHECKOUT_ITEMS = 50;
