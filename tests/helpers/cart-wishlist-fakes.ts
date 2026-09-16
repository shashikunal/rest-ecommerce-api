import { randomUUID } from 'crypto';

import type { Cart } from '@modules/cart/domain/entities/Cart';
import type {
  AddItemResult,
  CartCatalogPort,
  CartRepository,
  CatalogLineInfo,
} from '@modules/cart/domain/repositories/CartRepository';
import type { Wishlist } from '@modules/wishlist/domain/entities/Wishlist';
import type {
  WishlistAddResult,
  WishlistCatalogPort,
  WishlistCatalogInfo,
  WishlistRepository,
} from '@modules/wishlist/domain/repositories/WishlistRepository';

export class FakeCartRepository implements CartRepository {
  readonly store = new Map<string, Cart>();

  private get(userId: string): Cart {
    let cart = this.store.get(userId);
    if (!cart) {
      const now = new Date();
      cart = {
        id: randomUUID(),
        userId,
        status: 'active',
        items: [],
        version: 0,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };
      this.store.set(userId, cart);
    }
    return cart;
  }

  async getByUserId(userId: string): Promise<Cart | null> {
    return this.store.get(userId) ?? null;
  }

  async getOrCreate(userId: string): Promise<Cart> {
    return this.get(userId);
  }

  async addOrMergeItem(
    userId: string,
    expectedVersion: number | null,
    item: Parameters<CartRepository['addOrMergeItem']>[2],
  ): Promise<AddItemResult> {
    const cart = this.get(userId);
    if (expectedVersion !== null && cart.version !== expectedVersion) {
      const { CartStaleError } = await import('@modules/cart/domain/errors/CartErrors');
      throw new CartStaleError();
    }
    const now = new Date();
    const existing = cart.items.find((i) => i.sku === item.sku);
    if (existing) {
      const merged = cart.items.map((i) =>
        i.sku === item.sku
          ? {
              ...i,
              quantity: i.quantity + item.quantity,
              price: item.price,
              title: item.title,
              updatedAt: now,
            }
          : i,
      );
      const updated: Cart = {
        ...cart,
        items: merged,
        version: cart.version + 1,
        updatedAt: now,
        lastActivityAt: now,
      };
      this.store.set(userId, updated);
      return { cart: updated, created: false };
    }
    if (cart.items.length >= 50) {
      const { CartStaleError } = await import('@modules/cart/domain/errors/CartErrors');
      throw new CartStaleError('Cart line limit exceeded or concurrent modification');
    }
    const updated: Cart = {
      ...cart,
      items: [...cart.items, { ...item, priceStale: false, unavailable: false }],
      version: cart.version + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    this.store.set(userId, updated);
    return { cart: updated, created: true };
  }

  async updateQuantity(
    userId: string,
    itemId: string,
    quantity: number,
    expectedVersion: number,
  ): Promise<Cart> {
    const cart = this.get(userId);
    if (cart.version !== expectedVersion) {
      const { CartStaleError } = await import('@modules/cart/domain/errors/CartErrors');
      throw new CartStaleError();
    }
    if (!cart.items.some((i) => i.itemId === itemId)) {
      const { CartItemNotFoundError } = await import('@modules/cart/domain/errors/CartErrors');
      throw new CartItemNotFoundError();
    }
    const now = new Date();
    const updated: Cart = {
      ...cart,
      items: cart.items.map((i) => (i.itemId === itemId ? { ...i, quantity, updatedAt: now } : i)),
      version: cart.version + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    this.store.set(userId, updated);
    return updated;
  }

  async removeItem(userId: string, itemId: string, expectedVersion: number | null): Promise<Cart> {
    const cart = this.get(userId);
    if (expectedVersion !== null && cart.version !== expectedVersion) {
      const { CartStaleError } = await import('@modules/cart/domain/errors/CartErrors');
      throw new CartStaleError();
    }
    if (!cart.items.some((i) => i.itemId === itemId)) {
      const { CartItemNotFoundError } = await import('@modules/cart/domain/errors/CartErrors');
      throw new CartItemNotFoundError();
    }
    const now = new Date();
    const updated: Cart = {
      ...cart,
      items: cart.items.filter((i) => i.itemId !== itemId),
      version: cart.version + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    this.store.set(userId, updated);
    return updated;
  }

  async clear(userId: string, expectedVersion: number | null): Promise<Cart> {
    const cart = this.get(userId);
    if (expectedVersion !== null && cart.version !== expectedVersion) {
      const { CartStaleError } = await import('@modules/cart/domain/errors/CartErrors');
      throw new CartStaleError();
    }
    const now = new Date();
    const updated: Cart = {
      ...cart,
      items: [],
      version: cart.version + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    this.store.set(userId, updated);
    return updated;
  }

  async markConverted(userId: string): Promise<void> {
    const cart = this.get(userId);
    this.store.set(userId, { ...cart, status: 'converted' });
  }
}

export class FakeCartCatalog implements CartCatalogPort {
  constructor(private readonly lines: Map<string, CatalogLineInfo>) {}

  async resolveSku(sku: string): Promise<CatalogLineInfo | null> {
    return this.lines.get(sku.toUpperCase()) ?? null;
  }

  async resolveProductVariant(
    productId: string,
    variantId?: string,
  ): Promise<CatalogLineInfo | null> {
    for (const line of this.lines.values()) {
      if (line.productId === productId && (!variantId || line.variantId === variantId)) return line;
    }
    return null;
  }

  async refreshLineInfo(
    lines: Array<{ sku: string }>,
  ): Promise<Map<string, CatalogLineInfo | null>> {
    const result = new Map<string, CatalogLineInfo | null>();
    for (const line of lines) result.set(line.sku, this.lines.get(line.sku) ?? null);
    return result;
  }
}

export function sellableLine(overrides: Partial<CatalogLineInfo> = {}): CatalogLineInfo {
  return {
    productId: '123e4567-e89b-42d3-a456-426614174013',
    variantId: '123e4567-e89b-42d3-a456-426614174014',
    sku: 'SKU-001',
    title: 'Test Product',
    variantLabel: 'color: red',
    imageUrl: null,
    unitMinor: 1999,
    currency: 'USD',
    purchasable: true,
    ...overrides,
  };
}

export class FakeWishlistRepository implements WishlistRepository {
  readonly store = new Map<string, Wishlist>();

  private get(userId: string): Wishlist {
    let wishlist = this.store.get(userId);
    if (!wishlist) {
      const now = new Date();
      wishlist = {
        id: randomUUID(),
        userId,
        items: [],
        version: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.store.set(userId, wishlist);
    }
    return wishlist;
  }

  async getByUserId(userId: string): Promise<Wishlist | null> {
    return this.store.get(userId) ?? null;
  }

  async getOrCreate(userId: string): Promise<Wishlist> {
    return this.get(userId);
  }

  async addItem(
    userId: string,
    item: {
      itemId: string;
      productId: string;
      variantId: string | null;
      sku: string;
      addedAt: Date;
    },
  ): Promise<WishlistAddResult> {
    const wishlist = this.get(userId);
    const dup = wishlist.items.find(
      (i) =>
        i.productId === item.productId && (i.variantId ?? i.sku) === (item.variantId ?? item.sku),
    );
    if (dup) return { wishlist, created: false };
    const updated: Wishlist = {
      ...wishlist,
      items: [
        ...wishlist.items,
        {
          ...item,
          title: '',
          imageUrl: null,
          unitMinor: null,
          currency: null,
          state: 'AVAILABLE' as const,
        },
      ],
      version: wishlist.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(userId, updated);
    return { wishlist: updated, created: true };
  }

  async removeItem(userId: string, itemId: string): Promise<Wishlist> {
    const wishlist = this.get(userId);
    if (!wishlist.items.some((i) => i.itemId === itemId)) {
      const { WishlistItemNotFoundError } =
        await import('@modules/wishlist/domain/errors/WishlistErrors');
      throw new WishlistItemNotFoundError();
    }
    const updated: Wishlist = {
      ...wishlist,
      items: wishlist.items.filter((i) => i.itemId !== itemId),
      version: wishlist.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(userId, updated);
    return updated;
  }

  async list(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ wishlist: Wishlist; nextCursor: string | null; hasMore: boolean }> {
    const wishlist = this.get(userId);
    const sorted = [...wishlist.items].sort(
      (a, b) => b.addedAt.getTime() - a.addedAt.getTime() || b.itemId.localeCompare(a.itemId),
    );
    let start = 0;
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as {
          addedAt: number;
          itemId: string;
        };
        const index = sorted.findIndex(
          (i) => i.addedAt.getTime() === decoded.addedAt && i.itemId === decoded.itemId,
        );
        start = index >= 0 ? index + 1 : 0;
      } catch {
        throw new Error('INVALID_CURSOR');
      }
    }
    const page = sorted.slice(start, start + limit);
    const hasMore = start + limit < sorted.length;
    const last = page[page.length - 1];
    return {
      wishlist: { ...wishlist, items: page },
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ addedAt: last.addedAt.getTime(), itemId: last.itemId }),
            ).toString('base64')
          : null,
      hasMore,
    };
  }
}

export class FakeWishlistCatalog implements WishlistCatalogPort {
  constructor(private readonly infos: Map<string, WishlistCatalogInfo>) {}

  async lookup(sku?: string, productId?: string): Promise<WishlistCatalogInfo | null> {
    if (sku) return this.infos.get(sku.toUpperCase()) ?? null;
    if (productId) {
      for (const info of this.infos.values()) if (info.productId === productId) return info;
    }
    return null;
  }

  async refresh(
    items: Array<{ sku: string; productId: string }>,
  ): Promise<Map<string, WishlistCatalogInfo | null>> {
    const result = new Map<string, WishlistCatalogInfo | null>();
    for (const item of items) result.set(item.sku, this.infos.get(item.sku) ?? null);
    return result;
  }
}

export function wishlistInfo(overrides: Partial<WishlistCatalogInfo> = {}): WishlistCatalogInfo {
  return {
    productId: '123e4567-e89b-42d3-a456-426614174013',
    variantId: '123e4567-e89b-42d3-a456-426614174014',
    sku: 'SKU-001',
    title: 'Test Product',
    imageUrl: null,
    unitMinor: 1999,
    currency: 'USD',
    available: true,
    exists: true,
    ...overrides,
  };
}
