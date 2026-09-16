import { randomUUID } from 'crypto';

import { describe, it, expect } from 'vitest';

import { CheckoutService } from '../../src/modules/checkout/application/CheckoutService';
import type {
  CheckoutCartPort,
  CheckoutCartSnapshot,
} from '../../src/modules/checkout/domain/ports/CheckoutPorts';
import { InventoryServiceCheckoutInventoryAdapter } from '../../src/modules/checkout/infrastructure/inventory/checkout-inventory.adapter';
import { InventoryService } from '../../src/modules/inventory/application/InventoryService';
import {
  FakeCheckoutAddress,
  FakeCheckoutCatalog,
  FakeCheckoutPricing,
  FakeCheckoutRepository,
  FakeCheckoutUser,
  addressInput,
  cartItem,
  defaultCustomer,
  priceLine,
} from '../helpers/checkout-fakes';
import { testLogger } from '../helpers/fakes';
import {
  FakeInventoryCatalog,
  FakeInventoryEventPublisher,
  FakeInventoryRepository,
  FakeMovementRepository,
  FakeReservationRepository,
  catalogRef as inventoryCatalogRef,
  makeInventory,
} from '../helpers/inventory-fakes';

class MultiUserCart implements CheckoutCartPort {
  constructor(private readonly carts: Map<string, CheckoutCartSnapshot>) {}

  async getCart(userId: string): Promise<CheckoutCartSnapshot | null> {
    const snapshot = this.carts.get(userId);
    if (!snapshot) return null;
    return { ...snapshot, items: snapshot.items.map((i) => ({ ...i })) };
  }
}

function userCart(version: number): CheckoutCartSnapshot {
  return {
    cartId: randomUUID(),
    version,
    status: 'active',
    currency: 'USD',
    items: [cartItem()],
  };
}

describe('Checkout load', () => {
  it('holds inventory invariants across 200 concurrent create+reserve flows on stock 50', async () => {
    const inventories = new FakeInventoryRepository();
    const reservations = new FakeReservationRepository();
    const movements = new FakeMovementRepository();
    const invCatalog = new FakeInventoryCatalog(new Map([['SKU-001', inventoryCatalogRef()]]));
    const invEvents = new FakeInventoryEventPublisher();
    const inventoryService = new InventoryService(
      inventories,
      reservations,
      movements,
      invCatalog,
      invEvents,
      testLogger,
    );
    inventories.store.set('SKU-001', makeInventory({ sku: 'SKU-001', onHand: 50 }));

    const carts = new Map<string, CheckoutCartSnapshot>();
    const userIds = Array.from({ length: 200 }, (_, i) => `load-user-${i}`);
    for (const userId of userIds) carts.set(userId, userCart(1));

    const sharedCheckouts = new FakeCheckoutRepository();
    const buildSharedService = (): CheckoutService =>
      new CheckoutService(
        sharedCheckouts,
        new MultiUserCart(carts),
        new FakeCheckoutCatalog(new Map([['SKU-001', priceLine()]])),
        new FakeCheckoutPricing(),
        new FakeCheckoutAddress(),
        new FakeCheckoutUser(defaultCustomer()),
        new InventoryServiceCheckoutInventoryAdapter(inventoryService),
        testLogger,
      );

    const results = await Promise.all(
      userIds.map(async (userId, index) => {
        const service = buildSharedService();
        const key = randomUUID();
        try {
          const { view } = await service.createCheckout(userId, {
            shippingAddress: addressInput(),
            billingAddress: null,
            couponCode: null,
            idempotencyKey: key,
            reqHash: `hash-${index}`,
          });
          if (index % 10 === 0) {
            const replay = await service.createCheckout(userId, {
              shippingAddress: addressInput(),
              billingAddress: null,
              couponCode: null,
              idempotencyKey: key,
              reqHash: `hash-${index}`,
            });
            if (replay.view.id !== view.id || replay.created !== false) return 'error' as const;
          }
          const ready = await service.reserveCheckout(userId, view.id);
          return ready.status === 'ready' ? ('ready' as const) : ('error' as const);
        } catch (error) {
          const code = (error as { code?: string }).code;
          return code === 'INSUFFICIENT_STOCK' ? ('stockout' as const) : ('error' as const);
        }
      }),
    );

    const ready = results.filter((r) => r === 'ready').length;
    const stockout = results.filter((r) => r === 'stockout').length;
    const errored = results.filter((r) => r === 'error').length;
    const record = (await inventories.findBySku('SKU-001'))!;

    expect(ready).toBe(25);
    expect(stockout).toBe(175);
    expect(errored).toBe(0);
    expect(record.reserved).toBe(50);
    expect(record.onHand - record.reserved).toBeGreaterThanOrEqual(0);
    expect(reservations.store.size).toBe(25);

    const failedCheckouts = [...sharedCheckouts.store.values()].filter(
      (c) => c.status === 'failed',
    );
    expect(failedCheckouts.length).toBe(175);
    const readyCheckouts = [...sharedCheckouts.store.values()].filter((c) => c.status === 'ready');
    expect(readyCheckouts.length).toBe(25);
    expect(new Set(readyCheckouts.map((c) => c.id)).size).toBe(25);
  });
});
