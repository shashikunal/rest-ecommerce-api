import { randomUUID } from 'crypto';

import type { Checkout, CheckoutStatus } from '@modules/checkout/domain/entities/Checkout';
import type {
  AddressInput,
  CatalogPriceLine,
  CheckoutCartPort,
  CheckoutCartSnapshot,
  CheckoutCatalogPort,
  CheckoutCustomer,
  CheckoutInventoryPort,
  CheckoutPricingPort,
  CheckoutAddressPort,
  CheckoutUserPort,
  PriceLineInput,
  PricedTotals,
  ResolvedAddress,
} from '@modules/checkout/domain/ports/CheckoutPorts';
import type {
  CheckoutListOptions,
  CheckoutListResult,
  CheckoutRepository,
} from '@modules/checkout/domain/repositories/CheckoutRepository';
import { InsufficientStockError } from '@modules/inventory/domain/errors/InventoryErrors';

export const CO_USER_ID = 'user-checkout-1';
export const CO_CART_ID = '123e4567-e89b-42d3-a456-426614174099';
export const CO_PROD_ID = '123e4567-e89b-42d3-a456-426614174013';
export const CO_VAR_ID = '123e4567-e89b-42d3-a456-426614174014';

export function cloneCheckout(checkout: Checkout): Checkout {
  return {
    ...checkout,
    items: checkout.items.map((i) => ({ ...i })),
    shippingAddress: { ...checkout.shippingAddress },
    billingAddress: { ...checkout.billingAddress },
    pricing: { ...checkout.pricing },
    customer: { ...checkout.customer },
    reservations: checkout.reservations.map((r) => ({ ...r })),
  };
}

export function makeCheckoutAddress(overrides: Partial<ResolvedAddress> = {}): ResolvedAddress {
  return {
    fullName: 'Ada Lovelace',
    phone: '+10000000000',
    line1: '1 Algorithm Ave',
    line2: null,
    city: 'London',
    region: 'LDN',
    postalCode: 'E1 6AN',
    country: 'GB',
    ...overrides,
  };
}

export function makeCheckout(overrides: Partial<Checkout> = {}): Checkout {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: randomUUID(),
    userId: CO_USER_ID,
    cartId: CO_CART_ID,
    cartVersion: 3,
    status: 'priced',
    items: [
      {
        productId: CO_PROD_ID,
        variantId: CO_VAR_ID,
        sku: 'SKU-001',
        title: 'Test Product',
        variantLabel: 'color: red',
        quantity: 2,
        unitMinor: 1999,
        currency: 'USD',
        lineTotalMinor: 3998,
      },
    ],
    shippingAddress: makeCheckoutAddress(),
    billingAddress: makeCheckoutAddress(),
    pricing: {
      subtotalMinor: 3998,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      grandTotalMinor: 3998,
      currency: 'USD',
      couponCode: null,
    },
    currency: 'USD',
    customer: { userId: CO_USER_ID, email: 'ada@example.com', name: 'Ada Lovelace' },
    reservations: [],
    idempotencyKey: randomUUID(),
    reqHash: 'hash-1',
    failReason: null,
    orderId: null,
    version: 0,
    expiresAt: new Date(now.getTime() + 1800 * 1000),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export class FakeCheckoutRepository implements CheckoutRepository {
  readonly store = new Map<string, Checkout>();

  async create(checkout: Checkout): Promise<void> {
    if (this.store.has(checkout.id)) throw new Error('E11000 duplicate _id');
    for (const existing of this.store.values()) {
      if (
        checkout.idempotencyKey &&
        existing.userId === checkout.userId &&
        existing.idempotencyKey === checkout.idempotencyKey
      ) {
        throw new Error('E11000 duplicate user+idem');
      }
    }
    this.store.set(checkout.id, cloneCheckout(checkout));
  }

  async findById(id: string): Promise<Checkout | null> {
    const checkout = this.store.get(id);
    return checkout ? cloneCheckout(checkout) : null;
  }

  async findByUserAndKey(userId: string, idempotencyKey: string): Promise<Checkout | null> {
    for (const checkout of this.store.values()) {
      if (checkout.userId === userId && checkout.idempotencyKey === idempotencyKey) {
        return cloneCheckout(checkout);
      }
    }
    return null;
  }

  async listByUser(userId: string, options: CheckoutListOptions): Promise<CheckoutListResult> {
    let items = [...this.store.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    if (options.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(options.cursor, 'base64').toString('utf-8')) as {
          createdAt: number;
          id: string;
        };
        items = items.filter(
          (c) =>
            c.createdAt.getTime() < decoded.createdAt ||
            (c.createdAt.getTime() === decoded.createdAt && c.id < decoded.id),
        );
      } catch {
        throw new Error('INVALID_CURSOR');
      }
    }
    const page = items.slice(0, options.limit);
    const hasMore = items.length > options.limit;
    const last = page[page.length - 1];
    return {
      checkouts: page.map((c) => cloneCheckout(c)),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt.getTime(), id: last.id }),
            ).toString('base64')
          : null,
    };
  }

  async transition(
    id: string,
    from: CheckoutStatus[],
    to: CheckoutStatus,
    expectedVersion?: number,
  ): Promise<Checkout | null> {
    const checkout = this.store.get(id);
    if (!checkout || !from.includes(checkout.status)) return null;
    if (expectedVersion !== undefined && checkout.version !== expectedVersion) return null;
    const updated: Checkout = {
      ...checkout,
      status: to,
      version: checkout.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return cloneCheckout(updated);
  }

  async setReservations(
    id: string,
    reservations: Checkout['reservations'],
    expectedVersion: number,
  ): Promise<Checkout | null> {
    const checkout = this.store.get(id);
    if (!checkout || checkout.version !== expectedVersion) return null;
    const updated: Checkout = {
      ...checkout,
      reservations: reservations.map((r) => ({ ...r })),
      version: checkout.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return cloneCheckout(updated);
  }

  async updateAddress(
    id: string,
    shipping: Checkout['shippingAddress'],
    billing: Checkout['billingAddress'],
    expectedVersion: number,
  ): Promise<Checkout | null> {
    const checkout = this.store.get(id);
    if (!checkout || checkout.version !== expectedVersion) return null;
    const updated: Checkout = {
      ...checkout,
      shippingAddress: { ...shipping },
      billingAddress: { ...billing },
      version: checkout.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return cloneCheckout(updated);
  }

  async markFailed(id: string, reason: string, expectedVersion?: number): Promise<Checkout | null> {
    const checkout = this.store.get(id);
    if (!checkout) return null;
    if (expectedVersion !== undefined && checkout.version !== expectedVersion) return null;
    const updated: Checkout = {
      ...checkout,
      status: 'failed',
      failReason: reason,
      version: checkout.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return cloneCheckout(updated);
  }

  async markCompleted(
    id: string,
    orderId: string,
    expectedVersion?: number,
  ): Promise<Checkout | null> {
    const checkout = this.store.get(id);
    if (!checkout || checkout.status !== 'ready') return null;
    if (expectedVersion !== undefined && checkout.version !== expectedVersion) return null;
    const updated: Checkout = {
      ...checkout,
      status: 'completed',
      orderId,
      version: checkout.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return cloneCheckout(updated);
  }

  async findActiveExpired(now: Date, limit: number): Promise<Checkout[]> {
    return [...this.store.values()]
      .filter(
        (c) =>
          (c.status === 'priced' || c.status === 'reserved' || c.status === 'ready') &&
          c.expiresAt <= now,
      )
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
      .slice(0, limit)
      .map((c) => cloneCheckout(c));
  }
}

export function cartItem(overrides: Partial<CheckoutCartSnapshot['items'][number]> = {}) {
  return {
    sku: 'SKU-001',
    productId: CO_PROD_ID,
    variantId: CO_VAR_ID,
    title: 'Test Product',
    quantity: 2,
    unitMinor: 1999,
    currency: 'USD',
    ...overrides,
  };
}

export class FakeCheckoutCart implements CheckoutCartPort {
  constructor(private snapshot: CheckoutCartSnapshot | null) {}

  setSnapshot(snapshot: CheckoutCartSnapshot | null): void {
    this.snapshot = snapshot;
  }

  async getCart(): Promise<CheckoutCartSnapshot | null> {
    if (!this.snapshot) return null;
    return { ...this.snapshot, items: this.snapshot.items.map((i) => ({ ...i })) };
  }
}

export function cartSnapshot(overrides: Partial<CheckoutCartSnapshot> = {}): CheckoutCartSnapshot {
  return {
    cartId: CO_CART_ID,
    version: 3,
    status: 'active',
    currency: 'USD',
    items: [cartItem()],
    ...overrides,
  };
}

export function priceLine(overrides: Partial<CatalogPriceLine> = {}): CatalogPriceLine {
  return {
    productId: CO_PROD_ID,
    variantId: CO_VAR_ID,
    sku: 'SKU-001',
    title: 'Test Product',
    variantLabel: 'color: red',
    unitMinor: 1999,
    currency: 'USD',
    purchasable: true,
    ...overrides,
  };
}

export class FakeCheckoutCatalog implements CheckoutCatalogPort {
  constructor(private readonly lines: Map<string, CatalogPriceLine>) {}

  setLine(sku: string, line: CatalogPriceLine | null): void {
    if (line) this.lines.set(sku.toUpperCase(), line);
    else this.lines.delete(sku.toUpperCase());
  }

  async getLine(sku: string): Promise<CatalogPriceLine | null> {
    const line = this.lines.get(sku.trim().toUpperCase());
    return line ? { ...line } : null;
  }
}

export class FakeCheckoutPricing implements CheckoutPricingPort {
  async price(lines: PriceLineInput[], currency: string): Promise<PricedTotals> {
    const subtotalMinor = lines.reduce((sum, l) => sum + l.quantity * l.unitMinor, 0);
    return {
      subtotalMinor,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      grandTotalMinor: subtotalMinor,
      currency,
    };
  }
}

export class FakeCheckoutAddress implements CheckoutAddressPort {
  async resolveShipping(input: AddressInput): Promise<ResolvedAddress> {
    return {
      fullName: input.fullName,
      phone: input.phone ?? null,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      region: input.region,
      postalCode: input.postalCode,
      country: input.country,
    };
  }

  async resolveBilling(
    input: AddressInput | null,
    shipping: AddressInput,
  ): Promise<ResolvedAddress> {
    if (!input) return this.resolveShipping(shipping);
    return this.resolveShipping(input);
  }
}

export class FakeCheckoutUser implements CheckoutUserPort {
  constructor(private customer: CheckoutCustomer | null = null) {}

  setCustomer(customer: CheckoutCustomer | null): void {
    this.customer = customer;
  }

  async getCustomer(): Promise<CheckoutCustomer | null> {
    return this.customer ? { ...this.customer } : null;
  }
}

export function defaultCustomer(): CheckoutCustomer {
  return { userId: CO_USER_ID, email: 'ada@example.com', name: 'Ada Lovelace' };
}

export class FakeCheckoutInventory implements CheckoutInventoryPort {
  readonly reserved: Array<{ reservationId: string; sku: string; quantity: number }> = [];
  readonly released: string[] = [];
  failSkus = new Set<string>();
  failAll = false;

  async reserve(input: {
    sku: string;
    quantity: number;
    referenceId: string;
    idempotencyKey: string;
    ttlSeconds: number;
  }): Promise<{ reservationId: string; sku: string; quantity: number }> {
    if (this.failAll || this.failSkus.has(input.sku)) {
      throw new InsufficientStockError(`Insufficient stock for SKU ${input.sku}`);
    }
    const existing = this.reserved.find((r) => r.reservationId === `res-${input.idempotencyKey}`);
    if (existing) return { ...existing };
    const ref = {
      reservationId: `res-${input.idempotencyKey}`,
      sku: input.sku,
      quantity: input.quantity,
    };
    this.reserved.push(ref);
    return { ...ref };
  }

  async release(reservationId: string): Promise<void> {
    this.released.push(reservationId);
    const index = this.reserved.findIndex((r) => r.reservationId === reservationId);
    if (index >= 0) this.reserved.splice(index, 1);
  }
}

export function addressInput(overrides: Partial<AddressInput> = {}): AddressInput {
  return {
    fullName: 'Ada Lovelace',
    phone: '+10000000000',
    line1: '1 Algorithm Ave',
    line2: null,
    city: 'London',
    region: 'LDN',
    postalCode: 'E1 6AN',
    country: 'GB',
    ...overrides,
  };
}
