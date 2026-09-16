import { randomUUID } from 'crypto';

import { describe, it, expect } from 'vitest';

import { CheckoutService } from '../../../src/modules/checkout/application/CheckoutService';
import {
  CO_USER_ID,
  FakeCheckoutAddress,
  FakeCheckoutCart,
  FakeCheckoutCatalog,
  FakeCheckoutInventory,
  FakeCheckoutPricing,
  FakeCheckoutRepository,
  FakeCheckoutUser,
  addressInput,
  cartItem,
  cartSnapshot,
  defaultCustomer,
  priceLine,
} from '../../helpers/checkout-fakes';
import { testLogger } from '../../helpers/fakes';

function setup() {
  const checkouts = new FakeCheckoutRepository();
  const carts = new FakeCheckoutCart(cartSnapshot());
  const catalog = new FakeCheckoutCatalog(new Map([['SKU-001', priceLine()]]));
  const pricing = new FakeCheckoutPricing();
  const addresses = new FakeCheckoutAddress();
  const users = new FakeCheckoutUser(defaultCustomer());
  const inventory = new FakeCheckoutInventory();
  const service = new CheckoutService(
    checkouts,
    carts,
    catalog,
    pricing,
    addresses,
    users,
    inventory,
    testLogger,
  );
  return { checkouts, carts, catalog, pricing, addresses, users, inventory, service };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    shippingAddress: addressInput(),
    billingAddress: null,
    couponCode: null,
    idempotencyKey: randomUUID(),
    reqHash: 'hash-1',
    ...overrides,
  };
}

describe('CheckoutService creation', () => {
  it('snapshots cart with authoritative catalog prices', async () => {
    const { service } = setup();
    const { view, created } = await service.createCheckout(CO_USER_ID, createInput());
    expect(created).toBe(true);
    expect(view.status).toBe('priced');
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({ sku: 'SKU-001', quantity: 2, unitMinor: 1999 });
    expect(view.pricing).toMatchObject({ subtotalMinor: 3998, grandTotalMinor: 3998 });
    expect(view.billingAddress).toMatchObject({ fullName: 'Ada Lovelace' });
    expect(view.customer).toMatchObject({ userId: CO_USER_ID, email: 'ada@example.com' });
    expect(view.reservations).toHaveLength(0);
  });

  it('rejects empty carts and unavailable items', async () => {
    const { service, carts } = setup();
    carts.setSnapshot(cartSnapshot({ items: [] }));
    await expect(service.createCheckout(CO_USER_ID, createInput())).rejects.toMatchObject({
      code: 'CART_EMPTY',
    });

    const { service: service2, carts: carts2, catalog } = setup();
    carts2.setSnapshot(cartSnapshot());
    catalog.setLine('SKU-001', priceLine({ purchasable: false }));
    await expect(service2.createCheckout(CO_USER_ID, createInput())).rejects.toMatchObject({
      code: 'ITEM_UNAVAILABLE',
    });

    const missing = setup();
    missing.carts.setSnapshot(cartSnapshot());
    missing.catalog.setLine('SKU-001', null);
    await expect(missing.service.createCheckout(CO_USER_ID, createInput())).rejects.toMatchObject({
      code: 'ITEM_UNAVAILABLE',
    });
  });

  it('replays same key + same hash and conflicts on different hash', async () => {
    const { service } = setup();
    const key = randomUUID();
    const first = await service.createCheckout(CO_USER_ID, createInput({ idempotencyKey: key }));
    expect(first.created).toBe(true);
    const replay = await service.createCheckout(CO_USER_ID, createInput({ idempotencyKey: key }));
    expect(replay.created).toBe(false);
    expect(replay.view.id).toBe(first.view.id);
    await expect(
      service.createCheckout(CO_USER_ID, createInput({ idempotencyKey: key, reqHash: 'other' })),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});

describe('CheckoutService validation', () => {
  it('detects cart changes and price changes, marking failed', async () => {
    const { service, carts } = setup();
    const { view } = await service.createCheckout(CO_USER_ID, createInput());

    carts.setSnapshot(cartSnapshot({ version: 4 }));
    const changed = await service.validateCheckout(CO_USER_ID, view.id);
    expect(changed.ok).toBe(false);
    expect(changed.issues[0]!.code).toBe('CART_CHANGED');
    expect(changed.view.status).toBe('failed');

    const second = setup();
    const created = await second.service.createCheckout(CO_USER_ID, createInput());
    second.catalog.setLine('SKU-001', priceLine({ unitMinor: 2499 }));
    const priced = await second.service.validateCheckout(CO_USER_ID, created.view.id);
    expect(priced.ok).toBe(false);
    expect(priced.issues[0]).toMatchObject({ code: 'PRICE_CHANGED', sku: 'SKU-001' });
    expect((await second.checkouts.findById(created.view.id))!.status).toBe('failed');
  });

  it('passes validation when nothing drifted', async () => {
    const { service } = setup();
    const { view } = await service.createCheckout(CO_USER_ID, createInput());
    const result = await service.validateCheckout(CO_USER_ID, view.id);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.view.status).toBe('priced');
  });
});

describe('CheckoutService reservation saga', () => {
  it('reserves all lines and reaches ready', async () => {
    const { service, inventory } = setup();
    const { view } = await service.createCheckout(CO_USER_ID, createInput());
    const ready = await service.reserveCheckout(CO_USER_ID, view.id);
    expect(ready.status).toBe('ready');
    expect(ready.reservations).toHaveLength(1);
    expect(ready.reservations[0]!.sku).toBe('SKU-001');
    expect(inventory.reserved).toHaveLength(1);

    const replay = await service.reserveCheckout(CO_USER_ID, view.id);
    expect(replay.status).toBe('ready');
    expect(inventory.reserved).toHaveLength(1);
  });

  it('compensates partial reservation failure and marks failed', async () => {
    const seeded = setup();
    seeded.carts.setSnapshot(
      cartSnapshot({ items: [cartItem(), cartItem({ sku: 'SKU-002', quantity: 1 })] }),
    );
    seeded.catalog.setLine('SKU-002', priceLine({ sku: 'SKU-002', unitMinor: 500 }));
    seeded.inventory.failSkus.add('SKU-002');
    const { view } = await seeded.service.createCheckout(CO_USER_ID, createInput());
    await expect(seeded.service.reserveCheckout(CO_USER_ID, view.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    });
    expect(seeded.inventory.reserved).toHaveLength(0);
    expect(seeded.inventory.released).toHaveLength(1);
    const stored = (await seeded.checkouts.findById(view.id))!;
    expect(stored.status).toBe('failed');
    expect(stored.failReason).toBe('INVENTORY_RESERVATION_FAILED');
  });
});

describe('CheckoutService cancellation and expiry', () => {
  it('cancels idempotently and releases reservations once', async () => {
    const { service, inventory } = setup();
    const { view } = await service.createCheckout(CO_USER_ID, createInput());
    await service.reserveCheckout(CO_USER_ID, view.id);
    const cancelled = await service.cancelCheckout(CO_USER_ID, view.id);
    expect(cancelled.view.status).toBe('cancelled');
    expect(cancelled.replayed).toBe(false);
    expect(inventory.reserved).toHaveLength(0);
    expect(inventory.released).toHaveLength(1);

    const again = await service.cancelCheckout(CO_USER_ID, view.id);
    expect(again.replayed).toBe(true);
    expect(inventory.released).toHaveLength(1);
  });

  it('expires past-due checkouts via sweep and lazy expiry', async () => {
    const { service, inventory, checkouts } = setup();
    const { view } = await service.createCheckout(CO_USER_ID, createInput());
    await service.reserveCheckout(CO_USER_ID, view.id);
    const stored = (await checkouts.findById(view.id))!;
    checkouts.store.set(stored.id, { ...stored, expiresAt: new Date(Date.now() - 1000) });

    await expect(service.reserveCheckout(CO_USER_ID, view.id)).rejects.toMatchObject({
      code: 'CHECKOUT_EXPIRED',
    });
    expect((await checkouts.findById(view.id))!.status).toBe('expired');
    expect(inventory.reserved).toHaveLength(0);

    const second = setup();
    const created = await second.service.createCheckout(CO_USER_ID, createInput());
    const storedSecond = (await second.checkouts.findById(created.view.id))!;
    second.checkouts.store.set(storedSecond.id, {
      ...storedSecond,
      expiresAt: new Date(Date.now() - 1000),
    });
    const summary = await second.service.expireCheckouts({ limit: 100 });
    expect(summary).toMatchObject({ scanned: 1, expired: 1, failed: 0 });
  });

  it('guards address updates by version and state', async () => {
    const { service } = setup();
    const { view } = await service.createCheckout(CO_USER_ID, createInput());
    const updated = await service.updateAddress(CO_USER_ID, view.id, {
      shipping: addressInput({ city: 'Paris' }),
      billing: null,
      expectedVersion: view.version,
    });
    expect(updated.shippingAddress.city).toBe('Paris');
    await expect(
      service.updateAddress(CO_USER_ID, view.id, {
        shipping: addressInput({ city: 'Rome' }),
        billing: null,
        expectedVersion: view.version,
      }),
    ).rejects.toMatchObject({ code: 'CHECKOUT_CONFLICT' });
  });
});

describe('CheckoutService order handoff', () => {
  it('completes ready checkouts once for Phase 16', async () => {
    const { service, checkouts } = setup();
    const { view } = await service.createCheckout(CO_USER_ID, createInput());
    await service.reserveCheckout(CO_USER_ID, view.id);
    await service.complete({ checkoutId: view.id, orderId: 'order-1' });
    expect((await checkouts.findById(view.id))!.status).toBe('completed');
    await expect(
      service.complete({ checkoutId: view.id, orderId: 'order-2' }),
    ).rejects.toMatchObject({ code: 'CHECKOUT_CONFLICT' });
    await expect(service.getForOrder(view.id)).rejects.toMatchObject({
      code: 'CHECKOUT_CONFLICT',
    });
  });
});
