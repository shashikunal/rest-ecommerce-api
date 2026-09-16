export type CartStatus = 'active' | 'converted' | 'expired';

export interface CartPriceSnapshot {
  unitMinor: number;
  currency: string;
}

export interface CartItem {
  readonly itemId: string;
  readonly sku: string;
  readonly variantId: string;
  readonly productId: string;
  readonly title: string;
  readonly variantLabel: string | null;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly price: CartPriceSnapshot;
  readonly priceStale: boolean;
  readonly unavailable: boolean;
  readonly addedAt: Date;
  readonly updatedAt: Date;
}

export interface Cart {
  readonly id: string;
  readonly userId: string;
  readonly status: CartStatus;
  readonly items: CartItem[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastActivityAt: Date;
}

export const CART_MIN_QTY = 1;
export const CART_MAX_QTY = 50;
export const CART_MAX_LINES = 50;
export const CART_TTL_DAYS = 30;

const ALLOWED_TRANSITIONS: Record<CartStatus, CartStatus[]> = {
  active: ['converted', 'expired'],
  expired: ['active'],
  converted: [],
};

export function canTransitionCartStatus(from: CartStatus, to: CartStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function cartItemIdentity(sku: string): string {
  return sku.trim().toUpperCase();
}

export function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= CART_MIN_QTY &&
    value <= CART_MAX_QTY
  );
}

export function cartSubtotalMinor(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price.unitMinor * item.quantity, 0);
}
