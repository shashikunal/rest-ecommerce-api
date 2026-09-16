import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';

import {
  CART_MAX_LINES,
  cartItemIdentity,
  cartSubtotalMinor,
  isValidQuantity,
  type Cart,
} from '../domain/entities/Cart';
import {
  CartItemNotFoundError,
  CartLimitError,
  CartStaleError,
  InvalidQuantityError,
  SkuUnavailableError,
} from '../domain/errors/CartErrors';
import type { CartCatalogPort, CartRepository } from '../domain/repositories/CartRepository';

export interface AddToCartInput {
  sku?: string;
  productId?: string;
  variantId?: string;
  quantity: number;
  expectedVersion?: number;
}

export interface UpdateCartItemInput {
  quantity: number;
  expectedVersion: number;
}

export interface CartViewItem {
  itemId: string;
  sku: string;
  variantId: string;
  productId: string;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  quantity: number;
  unitMinor: number;
  currency: string;
  lineTotalMinor: number;
  priceStale: boolean;
  unavailable: boolean;
}

export interface CartView {
  id: string;
  status: Cart['status'];
  items: CartViewItem[];
  itemCount: number;
  subtotalMinor: number;
  currency: string | null;
  version: number;
  hasStalePrices: boolean;
  hasUnavailableItems: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: CartCatalogPort,
    private readonly logger: Logger,
  ) {}

  async getCart(userId: string, correlationId?: string): Promise<CartView> {
    const cart = await this.carts.getOrCreate(userId);
    const view = await this.toView(cart);
    this.logger.debug('cart.read', { userId, version: cart.version, correlationId });
    return view;
  }

  async addItem(
    userId: string,
    input: AddToCartInput,
    correlationId?: string,
  ): Promise<{ view: CartView; created: boolean }> {
    if (!isValidQuantity(input.quantity)) {
      this.logger.warn('cart.validation_failed', { userId, correlationId });
      throw new InvalidQuantityError();
    }
    const info = input.sku
      ? await this.catalog.resolveSku(cartItemIdentity(input.sku))
      : input.productId
        ? await this.catalog.resolveProductVariant(input.productId, input.variantId)
        : null;
    if (!info) {
      throw new SkuUnavailableError('Product variant not found or not purchasable');
    }
    if (!info.purchasable) {
      throw new SkuUnavailableError('Product variant is not currently purchasable');
    }
    const now = new Date();
    try {
      const { cart, created } = await this.carts.addOrMergeItem(
        userId,
        input.expectedVersion ?? null,
        {
          itemId: randomUUID(),
          sku: cartItemIdentity(info.sku),
          variantId: info.variantId,
          productId: info.productId,
          title: info.title,
          variantLabel: info.variantLabel,
          imageUrl: info.imageUrl,
          quantity: input.quantity,
          price: { unitMinor: info.unitMinor, currency: info.currency },
          addedAt: now,
          updatedAt: now,
        },
      );
      this.logger.info('cart.item_added', {
        userId,
        sku: info.sku,
        quantity: input.quantity,
        version: cart.version,
        correlationId,
      });
      return { view: await this.toView(cart), created };
    } catch (error) {
      if ((error as Error).message === 'QUANTITY_EXCEEDS_MAX') {
        throw new InvalidQuantityError('Merged quantity exceeds maximum of 50');
      }
      if (error instanceof CartStaleError) {
        this.logger.warn('cart.concurrency_conflict', { userId, correlationId });
      }
      throw error;
    }
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateCartItemInput,
    correlationId?: string,
  ): Promise<CartView> {
    if (!isValidQuantity(input.quantity)) throw new InvalidQuantityError();
    const cart = await this.carts.getByUserId(userId);
    const line = cart?.items.find((i) => i.itemId === itemId);
    if (!line) throw new CartItemNotFoundError();
    const info = await this.catalog.resolveSku(line.sku);
    if (!info || !info.purchasable) {
      throw new SkuUnavailableError('Product variant is no longer purchasable');
    }
    const updated = await this.carts.updateQuantity(
      userId,
      itemId,
      input.quantity,
      input.expectedVersion,
    );
    this.logger.info('cart.item_updated', { userId, itemId, correlationId });
    return this.toView(updated);
  }

  async removeItem(
    userId: string,
    itemId: string,
    expectedVersion?: number,
    correlationId?: string,
  ): Promise<CartView> {
    const cart = await this.carts.removeItem(userId, itemId, expectedVersion ?? null);
    this.logger.info('cart.item_removed', { userId, itemId, correlationId });
    return this.toView(cart);
  }

  async clearCart(
    userId: string,
    expectedVersion?: number,
    correlationId?: string,
  ): Promise<CartView> {
    const cart = await this.carts.clear(userId, expectedVersion ?? null);
    this.logger.info('cart.cleared', { userId, correlationId });
    return this.toView(cart);
  }

  private async toView(cart: Cart): Promise<CartView> {
    if (cart.items.length > CART_MAX_LINES) {
      throw new CartLimitError();
    }
    const refresh = await this.catalog.refreshLineInfo(cart.items.map((i) => ({ sku: i.sku })));
    const items: CartViewItem[] = cart.items.map((line) => {
      const current = refresh.get(line.sku);
      const priceStale = current
        ? current.unitMinor !== line.price.unitMinor || current.currency !== line.price.currency
        : false;
      const unavailable = !current || !current.purchasable;
      return {
        itemId: line.itemId,
        sku: line.sku,
        variantId: line.variantId,
        productId: line.productId,
        title: current?.title ?? line.title,
        variantLabel: line.variantLabel,
        imageUrl: current?.imageUrl ?? line.imageUrl,
        quantity: line.quantity,
        unitMinor: line.price.unitMinor,
        currency: line.price.currency,
        lineTotalMinor: line.price.unitMinor * line.quantity,
        priceStale,
        unavailable,
      };
    });
    return {
      id: cart.id,
      status: cart.status,
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotalMinor: cartSubtotalMinor(cart),
      currency: cart.items[0]?.price.currency ?? null,
      version: cart.version,
      hasStalePrices: items.some((i) => i.priceStale),
      hasUnavailableItems: items.some((i) => i.unavailable),
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      lastActivityAt: cart.lastActivityAt,
    };
  }
}
