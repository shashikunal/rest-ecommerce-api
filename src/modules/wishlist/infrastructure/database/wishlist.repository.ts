import type { Logger } from '@config/logger';
import { v4 as uuidv4 } from 'uuid';

import type { Wishlist } from '../../domain/entities/Wishlist';
import { WishlistItemNotFoundError } from '../../domain/errors/WishlistErrors';
import type {
  WishlistAddResult,
  WishlistRepository,
} from '../../domain/repositories/WishlistRepository';

import { WishlistModel, type IWishlist } from './wishlist.schema';

function toDomain(doc: IWishlist): Wishlist {
  return {
    id: String(doc._id),
    userId: doc.userId,
    items: (doc.items ?? []).map((i) => ({
      itemId: i.itemId,
      productId: i.productId,
      variantId: i.variantId,
      sku: i.sku,
      title: '',
      imageUrl: null,
      unitMinor: null,
      currency: null,
      state: 'AVAILABLE' as const,
      addedAt: i.addedAt,
    })),
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function decodeCursor(cursor: string): { addedAt: number; itemId: string } {
  const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as {
    addedAt: number;
    itemId: string;
  };
  if (typeof decoded.itemId !== 'string' || typeof decoded.addedAt !== 'number') {
    throw new Error('INVALID_CURSOR');
  }
  return decoded;
}

export class MongoWishlistRepository implements WishlistRepository {
  constructor(private readonly logger: Logger) {}

  async getByUserId(userId: string): Promise<Wishlist | null> {
    const doc = await WishlistModel.findOne({ userId }).select('-__v').lean().exec();
    return doc ? toDomain(doc as unknown as IWishlist) : null;
  }

  async getOrCreate(userId: string): Promise<Wishlist> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;
    try {
      await new WishlistModel({ _id: uuidv4(), userId, version: 0, items: [] }).save();
    } catch {
      const raced = await this.getByUserId(userId);
      if (raced) return raced;
      throw new Error('Wishlist creation failed');
    }
    const created = await this.getByUserId(userId);
    if (!created) throw new Error('Wishlist creation failed');
    return created;
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
    await this.getOrCreate(userId);
    const existing = await this.getByUserId(userId);
    const dup = existing?.items.find(
      (i) =>
        i.productId === item.productId && (i.variantId ?? i.sku) === (item.variantId ?? item.sku),
    );
    if (dup) return { wishlist: existing!, created: false };

    const doc = await WishlistModel.findOneAndUpdate(
      {
        userId,
        $nor: [
          { 'items.productId': item.productId, 'items.variantId': item.variantId },
          ...(item.variantId === null
            ? [{ 'items.productId': item.productId, 'items.sku': item.sku }]
            : []),
        ],
        'items.200': { $exists: false },
      },
      {
        $push: { items: { ...item, sku: item.sku.toUpperCase() } },
        $inc: { version: 1 },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (doc) return { wishlist: toDomain(doc as unknown as IWishlist), created: true };

    const current = await this.getByUserId(userId);
    const again = current?.items.find(
      (i) =>
        i.productId === item.productId && (i.variantId ?? i.sku) === (item.variantId ?? item.sku),
    );
    if (again && current) {
      this.logger.debug('wishlist.duplicate_attempt', { userId, sku: item.sku });
      return { wishlist: current, created: false };
    }
    throw new Error('WISHLIST_LIMIT_OR_CONFLICT');
  }

  async removeItem(userId: string, itemId: string): Promise<Wishlist> {
    const doc = await WishlistModel.findOneAndUpdate(
      { userId, 'items.itemId': itemId },
      { $pull: { items: { itemId } }, $inc: { version: 1 }, $set: { updatedAt: new Date() } },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (doc) return toDomain(doc as unknown as IWishlist);
    throw new WishlistItemNotFoundError();
  }

  async list(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ wishlist: Wishlist; nextCursor: string | null; hasMore: boolean }> {
    const wishlist = await this.getOrCreate(userId);
    const sorted = [...wishlist.items].sort(
      (a, b) => b.addedAt.getTime() - a.addedAt.getTime() || b.itemId.localeCompare(a.itemId),
    );
    let start = 0;
    if (cursor) {
      try {
        const decoded = decodeCursor(cursor);
        const index = sorted.findIndex(
          (i) => i.addedAt.getTime() === decoded.addedAt && i.itemId === decoded.itemId,
        );
        start = index >= 0 ? index + 1 : 0;
      } catch {
        throw new Error('INVALID_CURSOR');
      }
    }
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const page = sorted.slice(start, start + safeLimit);
    const hasMore = start + safeLimit < sorted.length;
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
