import { describe, it, expect } from 'vitest';

import { WishlistService } from '../../../src/modules/wishlist/application/WishlistService';
import {
  FakeWishlistRepository,
  FakeWishlistCatalog,
  wishlistInfo,
} from '../../helpers/cart-wishlist-fakes';
import { testLogger } from '../../helpers/fakes';

describe('Wishlist rules', () => {
  it('returns existing item on duplicate add (no 409)', async () => {
    const repos = new FakeWishlistRepository();
    const catalog = new FakeWishlistCatalog(new Map([['SKU-001', wishlistInfo()]]));
    const service = new WishlistService(repos, catalog, testLogger);
    const first = await service.addItem('u1', { sku: 'SKU-001' });
    expect(first.created).toBe(true);
    const second = await service.addItem('u1', { sku: 'sku-001' });
    expect(second.created).toBe(false);
    expect(second.view.itemId).toBe(first.view.itemId);
    const list = await service.list('u1', 20);
    expect(list.items).toHaveLength(1);
  });

  it('keeps references with graceful states when products change', async () => {
    const repos = new FakeWishlistRepository();
    const infos = new Map([['SKU-001', wishlistInfo()]]);
    const service = new WishlistService(repos, catalog(infos), testLogger);
    await service.addItem('u1', { sku: 'SKU-001' });
    infos.set('SKU-001', wishlistInfo({ available: false }));
    const unavailable = await service.list('u1', 20);
    expect(unavailable.items[0]!.state).toBe('UNAVAILABLE');
    infos.delete('SKU-001');
    const removed = await service.list('u1', 20);
    expect(removed.items[0]!.state).toBe('REMOVED');
  });

  it('paginates deterministically with cursor', async () => {
    const repos = new FakeWishlistRepository();
    const infos = new Map<string, ReturnType<typeof wishlistInfo>>();
    for (let i = 0; i < 3; i += 1) {
      infos.set(`SKU-${i}`, wishlistInfo({ sku: `SKU-${i}`, productId: `prod-${i}` }));
    }
    const service = new WishlistService(repos, new FakeWishlistCatalog(infos), testLogger);
    for (let i = 0; i < 3; i += 1) {
      await service.addItem('u1', { sku: `SKU-${i}` });
    }
    const first = await service.list('u1', 2);
    expect(first.items).toHaveLength(2);
    expect(first.pagination.hasMore).toBe(true);
    const second = await service.list('u1', 2, first.pagination.nextCursor!);
    expect(second.items).toHaveLength(1);
    expect(second.pagination.hasMore).toBe(false);
  });
});

function catalog(infos: Map<string, ReturnType<typeof wishlistInfo>>) {
  return new FakeWishlistCatalog(infos);
}
