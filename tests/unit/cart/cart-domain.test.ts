import { describe, it, expect } from 'vitest';

import { CartService } from '../../../src/modules/cart/application/CartService';
import {
  CART_MAX_QTY,
  cartItemIdentity,
  cartSubtotalMinor,
  isValidQuantity,
} from '../../../src/modules/cart/domain/entities/Cart';
import {
  FakeCartRepository,
  FakeCartCatalog,
  sellableLine,
} from '../../helpers/cart-wishlist-fakes';
import { testLogger } from '../../helpers/fakes';

function serviceWith(sku = 'SKU-001', unitMinor = 1999) {
  const repos = new FakeCartRepository();
  const catalog = new FakeCartCatalog(new Map([[sku, sellableLine({ sku, unitMinor })]]));
  return { repos, service: new CartService(repos, catalog, testLogger) };
}

describe('Cart domain rules', () => {
  it('validates quantities without float coercion', () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(CART_MAX_QTY)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
    expect(isValidQuantity(Infinity)).toBe(false);
    expect(isValidQuantity('2')).toBe(false);
  });

  it('normalizes sku identity', () => {
    expect(cartItemIdentity('  sku-1 ')).toBe('SKU-1');
  });

  it('computes subtotal in integer minor units', () => {
    const now = new Date();
    expect(
      cartSubtotalMinor({
        id: 'c',
        userId: 'u',
        status: 'active',
        items: [
          {
            itemId: 'i1',
            sku: 'A',
            variantId: 'v',
            productId: 'p',
            title: 't',
            variantLabel: null,
            imageUrl: null,
            quantity: 2,
            price: { unitMinor: 1999, currency: 'USD' },
            priceStale: false,
            unavailable: false,
            addedAt: now,
            updatedAt: now,
          },
        ],
        version: 0,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      }),
    ).toBe(3998);
  });

  it('merges duplicate adds instead of duplicating lines', async () => {
    const { service } = serviceWith();
    await service.addItem('u1', { sku: 'sku-001', quantity: 2 });
    const { view } = await service.addItem('u1', { sku: 'SKU-001', quantity: 3 });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]!.quantity).toBe(5);
    expect(view.itemCount).toBe(5);
  });

  it('rejects unavailable variants and unknown skus', async () => {
    const repos = new FakeCartRepository();
    const catalog = new FakeCartCatalog(
      new Map([['SKU-9', sellableLine({ sku: 'SKU-9', purchasable: false })]]),
    );
    const service = new CartService(repos, catalog, testLogger);
    await expect(service.addItem('u1', { sku: 'SKU-9', quantity: 1 })).rejects.toThrow();
    await expect(service.addItem('u1', { sku: 'NOPE', quantity: 1 })).rejects.toThrow();
  });

  it('flags stale prices on read without changing snapshots', async () => {
    const repos = new FakeCartRepository();
    const lines = new Map([['SKU-001', sellableLine({ unitMinor: 1999 })]]);
    const service = new CartService(repos, new FakeCartCatalog(lines), testLogger);
    await service.addItem('u1', { sku: 'SKU-001', quantity: 1 });
    lines.set('SKU-001', sellableLine({ unitMinor: 2499 }));
    const view = await service.getCart('u1');
    expect(view.hasStalePrices).toBe(true);
    expect(view.items[0]!.unitMinor).toBe(1999);
    expect(view.items[0]!.priceStale).toBe(true);
  });

  it('enforces optimistic concurrency on quantity updates', async () => {
    const { service } = serviceWith();
    const { view } = await service.addItem('u1', { sku: 'SKU-001', quantity: 1 });
    const itemId = view.items[0]!.itemId;
    await expect(
      service.updateItem('u1', itemId, { quantity: 2, expectedVersion: 999 }),
    ).rejects.toThrow();
    const updated = await service.updateItem('u1', itemId, {
      quantity: 2,
      expectedVersion: view.version,
    });
    expect(updated.items[0]!.quantity).toBe(2);
  });
});
