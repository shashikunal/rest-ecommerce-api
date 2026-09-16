import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';
import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

import type { WishlistItem } from '../domain/entities/Wishlist';
import type {
  WishlistCatalogPort,
  WishlistRepository,
} from '../domain/repositories/WishlistRepository';

export type WishlistViewItem = WishlistItem;

export interface WishlistView {
  items: WishlistViewItem[];
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
  version: number;
}

export class WishlistService {
  constructor(
    private readonly wishlists: WishlistRepository,
    private readonly catalog: WishlistCatalogPort,
    private readonly logger: Logger,
  ) {}

  async list(
    userId: string,
    limit: number,
    cursor?: string,
    correlationId?: string,
  ): Promise<WishlistView> {
    let page;
    try {
      page = await this.wishlists.list(userId, limit, cursor);
    } catch (error) {
      if ((error as Error).message === 'INVALID_CURSOR') {
        throw new AppError({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Invalid pagination cursor',
        });
      }
      throw error;
    }
    const refresh = await this.catalog.refresh(
      page.wishlist.items.map((i) => ({ sku: i.sku, productId: i.productId })),
    );
    const items: WishlistViewItem[] = page.wishlist.items.map((item) => {
      const current = refresh.get(item.sku);
      if (!current) {
        return { ...item, state: 'REMOVED' as const };
      }
      return {
        ...item,
        title: current.title,
        imageUrl: current.imageUrl,
        unitMinor: current.unitMinor,
        currency: current.currency,
        state: current.available ? ('AVAILABLE' as const) : ('UNAVAILABLE' as const),
      };
    });
    this.logger.debug('wishlist.read', { userId, correlationId });
    return {
      items,
      pagination: { limit, nextCursor: page.nextCursor, hasMore: page.hasMore },
      version: page.wishlist.version,
    };
  }

  async addItem(
    userId: string,
    input: { sku?: string; productId?: string; variantId?: string },
    correlationId?: string,
  ): Promise<{ view: WishlistViewItem; created: boolean }> {
    const info = await this.catalog.lookup(input.sku, input.productId, input.variantId);
    if (!info) {
      throw new AppError({ code: ERROR_CODES.PRODUCT_NOT_FOUND, message: 'Product not found' });
    }
    const now = new Date();
    let result;
    try {
      result = await this.wishlists.addItem(userId, {
        itemId: randomUUID(),
        productId: info.productId,
        variantId: info.variantId,
        sku: info.sku.toUpperCase(),
        addedAt: now,
      });
    } catch {
      throw new AppError({ code: ERROR_CODES.UNPROCESSABLE, message: 'Wishlist limit exceeded' });
    }
    this.logger.info(result.created ? 'wishlist.item_added' : 'wishlist.duplicate_attempt', {
      userId,
      sku: info.sku,
      correlationId,
    });
    const stored = result.wishlist.items.find(
      (i) =>
        i.productId === info.productId && (i.variantId ?? i.sku) === (info.variantId ?? info.sku),
    )!;
    const view: WishlistViewItem = {
      ...stored,
      title: info.title,
      imageUrl: info.imageUrl,
      unitMinor: info.unitMinor,
      currency: info.currency,
      state: info.available ? 'AVAILABLE' : 'UNAVAILABLE',
    };
    return { view, created: result.created };
  }

  async removeItem(userId: string, itemId: string, correlationId?: string): Promise<void> {
    await this.wishlists.removeItem(userId, itemId);
    this.logger.info('wishlist.item_removed', { userId, itemId, correlationId });
  }

  async check(
    userId: string,
    productId: string,
    variantId?: string,
  ): Promise<{ saved: boolean; itemId: string | null }> {
    const wishlist = await this.wishlists.getByUserId(userId);
    const found =
      wishlist?.items.find(
        (i) => i.productId === productId && (variantId ? i.variantId === variantId : true),
      ) ?? null;
    return { saved: Boolean(found), itemId: found?.itemId ?? null };
  }
}
