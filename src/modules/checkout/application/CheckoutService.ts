import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';
import type { MetricsCollector } from '@infrastructure/observability/metrics';
import { AppErrorFactory } from '@shared/errors/app-error-factory';

import {
  ACTIVE_CHECKOUT_STATUSES,
  CHECKOUT_TTL_SECONDS,
  MAX_CHECKOUT_ITEMS,
  type Checkout,
  type CheckoutItem,
} from '../domain/entities/Checkout';
import {
  CartChangedError,
  CartEmptyError,
  CheckoutConflictError,
  CheckoutExpiredError,
  CheckoutNotFoundError,
  ItemUnavailableError,
  PriceChangedError,
} from '../domain/errors/CheckoutErrors';
import type {
  AddressInput,
  CheckoutCartPort,
  CheckoutCatalogPort,
  CheckoutCompletionPort,
  CheckoutInventoryPort,
  CheckoutPricingPort,
  CheckoutAddressPort,
  CheckoutUserPort,
} from '../domain/ports/CheckoutPorts';
import type { CheckoutRepository } from '../domain/repositories/CheckoutRepository';

export interface CreateCheckoutInput {
  shippingAddress: AddressInput;
  billingAddress?: AddressInput | null;
  couponCode?: string | null;
  idempotencyKey: string;
  reqHash: string;
}

export interface CheckoutIssue {
  code: 'CART_EMPTY' | 'CART_CHANGED' | 'PRICE_CHANGED' | 'ITEM_UNAVAILABLE';
  message: string;
  sku?: string;
}

export interface CheckoutView {
  id: string;
  userId: string;
  status: Checkout['status'];
  items: CheckoutItem[];
  pricing: Checkout['pricing'];
  currency: string;
  shippingAddress: Checkout['shippingAddress'];
  billingAddress: Checkout['billingAddress'];
  customer: Checkout['customer'];
  reservations: Checkout['reservations'];
  cartId: string;
  cartVersion: number;
  version: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  failReason: string | null;
  orderId: string | null;
}

const NULL_METRICS: MetricsCollector = {
  increment(): void {},
  gauge(): void {},
  timing(): void {},
  getMetrics() {
    return [];
  },
  reset(): void {},
};

function isTerminalStatus(status: Checkout['status']): boolean {
  return (
    status === 'completed' || status === 'failed' || status === 'expired' || status === 'cancelled'
  );
}

export class CheckoutService implements CheckoutCompletionPort {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly carts: CheckoutCartPort,
    private readonly catalog: CheckoutCatalogPort,
    private readonly pricing: CheckoutPricingPort,
    private readonly addresses: CheckoutAddressPort,
    private readonly users: CheckoutUserPort,
    private readonly inventory: CheckoutInventoryPort,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector = NULL_METRICS,
  ) {}

  async createCheckout(
    userId: string,
    input: CreateCheckoutInput,
    correlationId?: string,
  ): Promise<{ view: CheckoutView; created: boolean }> {
    const prior = await this.checkouts.findByUserAndKey(userId, input.idempotencyKey);
    if (prior) {
      if (prior.reqHash !== input.reqHash) {
        throw AppErrorFactory.idempotencyConflict(correlationId);
      }
      this.logger.info('checkout.idempotency_replay', {
        checkoutId: prior.id,
        userId,
        correlationId,
      });
      this.metrics.increment('checkout_idempotency_replay_total');
      return { view: this.toView(prior), created: false };
    }

    const cart = await this.carts.getCart(userId, correlationId);
    if (!cart || cart.status !== 'active' || cart.items.length === 0) {
      throw new CartEmptyError('Cart is empty', correlationId);
    }
    if (cart.items.length > MAX_CHECKOUT_ITEMS) {
      throw new CartEmptyError('Cart exceeds the maximum checkout size', correlationId);
    }
    const customer = await this.users.getCustomer(userId, correlationId);
    if (!customer) {
      throw new CheckoutConflictError('Customer profile unavailable', correlationId);
    }

    const shipping = await this.addresses.resolveShipping(input.shippingAddress);
    const billing = await this.addresses.resolveBilling(input.billingAddress ?? null, shipping);

    const { items, currency } = await this.buildAuthoritativeItems(cart.items, correlationId);
    const totals = await this.pricing.price(
      items.map((item) => ({ quantity: item.quantity, unitMinor: item.unitMinor })),
      currency,
    );

    const now = new Date();
    const checkout: Checkout = {
      id: randomUUID(),
      userId,
      cartId: cart.cartId,
      cartVersion: cart.version,
      status: 'priced',
      items,
      shippingAddress: shipping,
      billingAddress: billing,
      pricing: { ...totals, couponCode: input.couponCode ?? null },
      currency,
      customer,
      reservations: [],
      idempotencyKey: input.idempotencyKey,
      reqHash: input.reqHash,
      failReason: null,
      orderId: null,
      version: 0,
      expiresAt: new Date(now.getTime() + CHECKOUT_TTL_SECONDS * 1000),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.checkouts.create(checkout);
    } catch (error) {
      if (/duplicate|E11000/i.test((error as Error).message)) {
        const winner = await this.checkouts.findByUserAndKey(userId, input.idempotencyKey);
        if (!winner) throw error;
        if (winner.reqHash !== input.reqHash) {
          throw AppErrorFactory.idempotencyConflict(correlationId);
        }
        this.logger.info('checkout.idempotency_replay', {
          checkoutId: winner.id,
          userId,
          correlationId,
        });
        return { view: this.toView(winner), created: false };
      }
      throw error;
    }
    this.metrics.increment('checkout_create_total');
    this.logger.info('checkout.created', {
      checkoutId: checkout.id,
      userId,
      cartId: cart.cartId,
      itemCount: items.length,
      grandTotalMinor: totals.grandTotalMinor,
      correlationId,
    });
    return { view: this.toView(checkout), created: true };
  }

  async getCheckout(userId: string, id: string, correlationId?: string): Promise<CheckoutView> {
    const checkout = await this.requireOwned(userId, id, correlationId);
    this.logger.debug('checkout.read', { checkoutId: id, userId, correlationId });
    return this.toView(checkout);
  }

  async listCheckouts(
    userId: string,
    options: { limit: number; cursor?: string },
    correlationId?: string,
  ): Promise<{
    checkouts: CheckoutView[];
    pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
  }> {
    let page;
    try {
      page = await this.checkouts.listByUser(userId, options);
    } catch (error) {
      if ((error as Error).message === 'INVALID_CURSOR') {
        throw AppErrorFactory.validation('cursor', 'Invalid pagination cursor');
      }
      throw error;
    }
    this.logger.debug('checkout.list', { userId, correlationId });
    return {
      checkouts: page.checkouts.map((c) => this.toView(c)),
      pagination: {
        limit: options.limit,
        nextCursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
      },
    };
  }

  async validateCheckout(
    userId: string,
    id: string,
    correlationId?: string,
  ): Promise<{ view: CheckoutView; ok: boolean; issues: CheckoutIssue[] }> {
    const checkout = await this.requireOwned(userId, id, correlationId);
    const live = await this.requireLive(checkout, correlationId);
    if (live.status !== 'priced' && live.status !== 'reserved' && live.status !== 'ready') {
      throw new CheckoutConflictError(
        `Checkout cannot be validated from status ${live.status}`,
        correlationId,
      );
    }
    this.logger.info('checkout.validation_started', { checkoutId: id, userId, correlationId });
    const issues = await this.revalidate(live, correlationId);
    if (issues.length === 0) {
      return { view: this.toView(live), ok: true, issues };
    }
    const failed = await this.checkouts.markFailed(live.id, issues[0]!.code, live.version);
    this.metrics.increment('checkout_validation_failure_total');
    this.logger.warn('checkout.validation_failed', {
      checkoutId: id,
      userId,
      issues: issues.map((i) => i.code),
      correlationId,
    });
    return { view: this.toView(failed ?? live), ok: false, issues };
  }

  async reserveCheckout(userId: string, id: string, correlationId?: string): Promise<CheckoutView> {
    const checkout = await this.requireOwned(userId, id, correlationId);
    const live = await this.requireLive(checkout, correlationId);
    if (live.status === 'reserved' || live.status === 'ready') {
      return this.toView(live);
    }
    if (live.status !== 'priced') {
      throw new CheckoutConflictError(
        `Checkout cannot be reserved from status ${live.status}`,
        correlationId,
      );
    }
    const issues = await this.revalidate(live, correlationId);
    if (issues.length > 0) {
      await this.checkouts.markFailed(live.id, issues[0]!.code, live.version);
      this.failForIssue(issues[0]!, correlationId);
    }

    const reserved = await this.checkouts.transition(live.id, ['priced'], 'reserved', live.version);
    if (!reserved) {
      this.metrics.increment('checkout_concurrency_conflict_total');
      this.logger.warn('checkout.concurrency_conflict', { checkoutId: id, userId, correlationId });
      throw new CheckoutConflictError('Checkout was modified by another request', correlationId);
    }

    const made: Array<{ reservationId: string; sku: string; quantity: number }> = [];
    try {
      for (const item of reserved.items) {
        const ref = await this.inventory.reserve(
          {
            sku: item.sku,
            quantity: item.quantity,
            referenceId: reserved.id,
            idempotencyKey: `${reserved.id}:${item.sku}`,
            ttlSeconds: this.remainingTtlSeconds(reserved),
          },
          correlationId,
        );
        made.push(ref);
      }
    } catch (error) {
      await this.compensate(reserved.id, made, userId, correlationId);
      await this.checkouts.markFailed(
        reserved.id,
        'INVENTORY_RESERVATION_FAILED',
        reserved.version,
      );
      this.metrics.increment('checkout_inventory_failure_total');
      this.logger.warn('checkout.inventory_failed', {
        checkoutId: id,
        userId,
        error: (error as Error).message,
        correlationId,
      });
      throw error;
    }

    const withRefs = await this.checkouts.setReservations(
      reserved.id,
      made.map((m) => ({ reservationId: m.reservationId, sku: m.sku, quantity: m.quantity })),
      reserved.version,
    );
    if (!withRefs) {
      await this.compensate(reserved.id, made, userId, correlationId);
      throw new CheckoutConflictError('Checkout was modified during reservation', correlationId);
    }
    const ready = await this.checkouts.transition(
      withRefs.id,
      ['reserved'],
      'ready',
      withRefs.version,
    );
    if (!ready) {
      await this.compensate(withRefs.id, made, userId, correlationId);
      throw new CheckoutConflictError('Checkout was modified during reservation', correlationId);
    }
    this.metrics.increment('checkout_inventory_reserved_total');
    this.metrics.increment('checkout_ready_total');
    this.logger.info('checkout.inventory_reserved', {
      checkoutId: id,
      userId,
      reservations: made.map((m) => m.reservationId),
      correlationId,
    });
    this.logger.info('checkout.ready_for_order', { checkoutId: id, userId, correlationId });
    return this.toView(ready);
  }

  async cancelCheckout(
    userId: string,
    id: string,
    expectedVersion?: number,
    correlationId?: string,
  ): Promise<{ view: CheckoutView; replayed: boolean }> {
    const checkout = await this.requireOwned(userId, id, correlationId);
    if (checkout.status === 'cancelled') {
      return { view: this.toView(checkout), replayed: true };
    }
    const live = await this.requireLive(checkout, correlationId);
    if (live.status !== 'priced' && live.status !== 'reserved' && live.status !== 'ready') {
      throw new CheckoutConflictError(
        `Checkout cannot be cancelled from status ${live.status}`,
        correlationId,
      );
    }
    const cancelled = await this.checkouts.transition(
      live.id,
      ['priced', 'reserved', 'ready'],
      'cancelled',
      expectedVersion ?? live.version,
    );
    if (!cancelled) {
      const current = await this.requireOwned(userId, id, correlationId);
      if (current.status === 'cancelled') return { view: this.toView(current), replayed: true };
      this.metrics.increment('checkout_concurrency_conflict_total');
      throw new CheckoutConflictError('Checkout was modified by another request', correlationId);
    }
    await this.compensate(cancelled.id, cancelled.reservations, userId, correlationId);
    this.metrics.increment('checkout_cancellation_total');
    this.logger.info('checkout.cancelled', { checkoutId: id, userId, correlationId });
    const refreshed = await this.requireOwned(userId, id, correlationId);
    return { view: this.toView(refreshed), replayed: false };
  }

  async updateAddress(
    userId: string,
    id: string,
    input: { shipping: AddressInput; billing?: AddressInput | null; expectedVersion: number },
    correlationId?: string,
  ): Promise<CheckoutView> {
    const checkout = await this.requireOwned(userId, id, correlationId);
    const live = await this.requireLive(checkout, correlationId);
    if (live.status !== 'priced' && live.status !== 'reserved' && live.status !== 'ready') {
      throw new CheckoutConflictError(
        `Address cannot be updated from status ${live.status}`,
        correlationId,
      );
    }
    const shipping = await this.addresses.resolveShipping(input.shipping);
    const billing = await this.addresses.resolveBilling(input.billing ?? null, shipping);
    const updated = await this.checkouts.updateAddress(
      live.id,
      shipping,
      billing,
      input.expectedVersion,
    );
    if (!updated) {
      this.metrics.increment('checkout_concurrency_conflict_total');
      throw new CheckoutConflictError('Checkout was modified by another request', correlationId);
    }
    this.logger.info('checkout.address_updated', { checkoutId: id, userId, correlationId });
    return this.toView(updated);
  }

  async expireCheckouts(
    options: { limit?: number; now?: Date } = {},
    correlationId?: string,
  ): Promise<{ scanned: number; expired: number; failed: number }> {
    const now = options.now ?? new Date();
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const due = await this.checkouts.findActiveExpired(now, limit);
    let expired = 0;
    let failed = 0;
    for (const checkout of due) {
      try {
        await this.compensate(checkout.id, checkout.reservations, checkout.userId, correlationId);
        const transitioned = await this.checkouts.transition(
          checkout.id,
          ['priced', 'reserved', 'ready'],
          'expired',
        );
        if (transitioned) {
          expired += 1;
          this.metrics.increment('checkout_expiration_total');
          this.logger.info('checkout.expired', { checkoutId: checkout.id, correlationId });
        }
      } catch (error) {
        failed += 1;
        this.logger.warn('checkout.expire_failed', {
          checkoutId: checkout.id,
          error: (error as Error).message,
          correlationId,
        });
      }
    }
    return { scanned: due.length, expired, failed };
  }

  async getForOrder(checkoutId: string, correlationId?: string): Promise<CheckoutView> {
    const checkout = await this.checkouts.findById(checkoutId);
    if (!checkout) throw new CheckoutNotFoundError('Checkout not found', correlationId);
    if (checkout.status !== 'ready') {
      throw new CheckoutConflictError(
        `Checkout is ${checkout.status}, only ready checkouts can be ordered`,
        correlationId,
      );
    }
    if (checkout.expiresAt.getTime() <= Date.now()) {
      throw new CheckoutExpiredError('Checkout has expired', correlationId);
    }
    return this.toView(checkout);
  }

  async complete(
    handoff: { checkoutId: string; orderId: string },
    expectedVersion?: number,
  ): Promise<void> {
    const completed = await this.checkouts.markCompleted(
      handoff.checkoutId,
      handoff.orderId,
      expectedVersion,
    );
    if (!completed) {
      throw new CheckoutConflictError('Checkout cannot be completed from its current state');
    }
    this.logger.info('checkout.completed', {
      checkoutId: handoff.checkoutId,
      orderId: handoff.orderId,
    });
  }

  private async requireOwned(
    userId: string,
    id: string,
    correlationId?: string,
  ): Promise<Checkout> {
    const checkout = await this.checkouts.findById(id);
    if (!checkout || checkout.userId !== userId) {
      throw new CheckoutNotFoundError('Checkout not found', correlationId);
    }
    return checkout;
  }

  private async requireLive(checkout: Checkout, correlationId?: string): Promise<Checkout> {
    if (isTerminalStatus(checkout.status)) return checkout;
    if (checkout.expiresAt.getTime() > Date.now()) return checkout;
    await this.compensate(checkout.id, checkout.reservations, checkout.userId, correlationId);
    const expired =
      (await this.checkouts.transition(checkout.id, ACTIVE_CHECKOUT_STATUSES, 'expired')) ??
      (await this.checkouts.findById(checkout.id));
    this.metrics.increment('checkout_expiration_total');
    this.logger.info('checkout.expired', { checkoutId: checkout.id, correlationId });
    void expired;
    throw new CheckoutExpiredError('Checkout has expired', correlationId);
  }

  private async revalidate(checkout: Checkout, correlationId?: string): Promise<CheckoutIssue[]> {
    const cart = await this.carts.getCart(checkout.userId, correlationId);
    if (!cart || cart.items.length === 0) {
      return [{ code: 'CART_EMPTY', message: 'Cart is empty' }];
    }
    if (!this.sameItemSet(cart, checkout)) {
      return [{ code: 'CART_CHANGED', message: 'Cart changed after checkout started' }];
    }
    const issues: CheckoutIssue[] = [];
    for (const item of checkout.items) {
      const line = await this.catalog.getLine(item.sku);
      if (!line || !line.purchasable) {
        issues.push({
          code: 'ITEM_UNAVAILABLE',
          message: `Item ${item.sku} is unavailable`,
          sku: item.sku,
        });
        continue;
      }
      if (line.unitMinor !== item.unitMinor || line.currency !== item.currency) {
        issues.push({
          code: 'PRICE_CHANGED',
          message: `Price changed for ${item.sku}`,
          sku: item.sku,
        });
      }
    }
    return issues;
  }

  private sameItemSet(
    cart: { cartId: string; version: number; items: Array<{ sku: string; quantity: number }> },
    checkout: Checkout,
  ): boolean {
    if (cart.cartId !== checkout.cartId || cart.version !== checkout.cartVersion) return false;
    if (cart.items.length !== checkout.items.length) return false;
    const expected = new Map(checkout.items.map((i) => [i.sku, i.quantity]));
    return cart.items.every((item) => expected.get(item.sku) === item.quantity);
  }

  private async buildAuthoritativeItems(
    cartItems: Array<{ sku: string; quantity: number }>,
    correlationId?: string,
  ): Promise<{ items: CheckoutItem[]; currency: string }> {
    const items: CheckoutItem[] = [];
    const currencies = new Set<string>();
    for (const cartItem of cartItems) {
      const line = await this.catalog.getLine(cartItem.sku);
      if (!line || !line.purchasable) {
        throw new ItemUnavailableError(`Item ${cartItem.sku} is unavailable`, correlationId);
      }
      if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1 || cartItem.quantity > 50) {
        throw new ItemUnavailableError(`Invalid quantity for ${cartItem.sku}`, correlationId);
      }
      currencies.add(line.currency);
      items.push({
        productId: line.productId,
        variantId: line.variantId,
        sku: line.sku,
        title: line.title,
        variantLabel: line.variantLabel,
        quantity: cartItem.quantity,
        unitMinor: line.unitMinor,
        currency: line.currency,
        lineTotalMinor: cartItem.quantity * line.unitMinor,
      });
    }
    if (currencies.size !== 1) {
      throw new CheckoutConflictError('Checkout items must share a single currency', correlationId);
    }
    return { items, currency: [...currencies][0]! };
  }

  private async compensate(
    checkoutId: string,
    refs: Array<{ reservationId: string; sku: string; quantity: number }>,
    userId: string,
    correlationId?: string,
  ): Promise<void> {
    for (const ref of refs) {
      try {
        await this.inventory.release(ref.reservationId, correlationId);
      } catch (error) {
        this.logger.warn('checkout.compensation_release_failed', {
          checkoutId,
          reservationId: ref.reservationId,
          userId,
          error: (error as Error).message,
          correlationId,
        });
      }
    }
  }

  private remainingTtlSeconds(checkout: Checkout): number {
    const remaining = Math.floor((checkout.expiresAt.getTime() - Date.now()) / 1000);
    return Math.max(60, Math.min(remaining, 3600));
  }

  private failForIssue(issue: CheckoutIssue, correlationId?: string): never {
    if (issue.code === 'CART_EMPTY') throw new CartEmptyError(issue.message, correlationId);
    if (issue.code === 'CART_CHANGED') throw new CartChangedError(issue.message, correlationId);
    if (issue.code === 'PRICE_CHANGED') throw new PriceChangedError(issue.message, correlationId);
    throw new ItemUnavailableError(issue.message, correlationId);
  }

  private toView(checkout: Checkout): CheckoutView {
    return {
      id: checkout.id,
      userId: checkout.userId,
      status: checkout.status,
      items: checkout.items.map((i) => ({ ...i })),
      pricing: { ...checkout.pricing },
      currency: checkout.currency,
      shippingAddress: { ...checkout.shippingAddress },
      billingAddress: { ...checkout.billingAddress },
      customer: { ...checkout.customer },
      reservations: checkout.reservations.map((r) => ({ ...r })),
      cartId: checkout.cartId,
      cartVersion: checkout.cartVersion,
      version: checkout.version,
      expiresAt: checkout.expiresAt,
      createdAt: checkout.createdAt,
      updatedAt: checkout.updatedAt,
      failReason: checkout.failReason,
      orderId: checkout.orderId,
    };
  }
}
