export interface CheckoutCartItem {
  sku: string;
  productId: string;
  variantId: string;
  title: string;
  quantity: number;
  unitMinor: number;
  currency: string;
}

export interface CheckoutCartSnapshot {
  cartId: string;
  version: number;
  status: string;
  currency: string | null;
  items: CheckoutCartItem[];
}

export interface CheckoutCartPort {
  getCart(userId: string, correlationId?: string): Promise<CheckoutCartSnapshot | null>;
}

export interface CatalogPriceLine {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantLabel: string | null;
  unitMinor: number;
  currency: string;
  purchasable: boolean;
}

export interface CheckoutCatalogPort {
  getLine(sku: string): Promise<CatalogPriceLine | null>;
}

export interface PriceLineInput {
  quantity: number;
  unitMinor: number;
}

export interface PricedTotals {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  grandTotalMinor: number;
  currency: string;
}

export interface CheckoutPricingPort {
  price(lines: PriceLineInput[], currency: string): Promise<PricedTotals>;
}

export interface AddressInput {
  fullName: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface CheckoutAddressPort {
  resolveShipping(input: AddressInput): Promise<ResolvedAddress>;
  resolveBilling(input: AddressInput | null, shipping: AddressInput): Promise<ResolvedAddress>;
}

export interface ResolvedAddress {
  fullName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface CheckoutCustomer {
  userId: string;
  email: string;
  name: string;
}

export interface CheckoutUserPort {
  getCustomer(userId: string, correlationId?: string): Promise<CheckoutCustomer | null>;
}

export interface CheckoutInventoryReservation {
  reservationId: string;
  sku: string;
  quantity: number;
}

export interface CheckoutInventoryPort {
  reserve(
    input: {
      sku: string;
      quantity: number;
      referenceId: string;
      idempotencyKey: string;
      ttlSeconds: number;
    },
    correlationId?: string,
  ): Promise<CheckoutInventoryReservation>;
  release(reservationId: string, correlationId?: string): Promise<void>;
}

export interface CompletedCheckoutHandoff {
  checkoutId: string;
  orderId: string;
}

export interface CheckoutCompletionPort {
  complete(handoff: CompletedCheckoutHandoff, expectedVersion?: number): Promise<void>;
}
