import type { Logger } from '@config/logger';
import { v4 as uuidv4 } from 'uuid';

import type { Cart, CartItem } from '../../domain/entities/Cart';
import { CartItemNotFoundError, CartStaleError } from '../../domain/errors/CartErrors';
import type { AddItemResult, CartRepository } from '../../domain/repositories/CartRepository';

import { CartModel, type ICart } from './cart.schema';

function toDomain(doc: ICart): Cart {
  return {
    id: String(doc._id),
    userId: doc.userId,
    status: doc.status as Cart['status'],
    items: (doc.items ?? []).map((i) => ({
      itemId: i.itemId,
      sku: i.sku,
      variantId: i.variantId,
      productId: i.productId,
      title: i.title,
      variantLabel: i.variantLabel,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
      price: { unitMinor: i.unitMinor, currency: i.currency },
      priceStale: false,
      unavailable: false,
      addedAt: i.addedAt,
      updatedAt: i.updatedAt,
    })),
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastActivityAt: doc.lastActivityAt,
  };
}

export class MongoCartRepository implements CartRepository {
  constructor(private readonly logger: Logger) {}

  async getByUserId(userId: string): Promise<Cart | null> {
    const doc = await CartModel.findOne({ userId }).select('-__v').lean().exec();
    return doc ? toDomain(doc as unknown as ICart) : null;
  }

  async getOrCreate(userId: string): Promise<Cart> {
    const existing = await this.getByUserId(userId);
    if (existing) {
      if (existing.status !== 'active') {
        const doc = await CartModel.findOneAndUpdate(
          { userId, status: existing.status },
          {
            $set: {
              status: 'active',
              lastActivityAt: new Date(),
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              updatedAt: new Date(),
            },
            $inc: { version: 1 },
          },
          { new: true },
        )
          .lean()
          .exec();
        if (doc) return toDomain(doc as unknown as ICart);
      }
      return existing;
    }
    try {
      const doc = new CartModel({
        _id: uuidv4(),
        userId,
        status: 'active',
        version: 0,
        items: [],
      });
      await doc.save();
      const lean = await CartModel.findOne({ userId }).select('-__v').lean().exec();
      return toDomain(lean as unknown as ICart);
    } catch {
      const raced = await this.getByUserId(userId);
      if (raced) return raced;
      throw new Error('Cart creation failed');
    }
  }

  async addOrMergeItem(
    userId: string,
    expectedVersion: number | null,
    item: Omit<CartItem, 'priceStale' | 'unavailable'>,
  ): Promise<AddItemResult> {
    await this.getOrCreate(userId);
    const now = new Date();
    const versionFilter = expectedVersion === null ? {} : { version: expectedVersion };

    const merged = await CartModel.findOneAndUpdate(
      { userId, status: 'active', ...versionFilter, 'items.sku': item.sku },
      {
        $inc: { 'items.$.quantity': item.quantity, version: 1 },
        $set: {
          'items.$.unitMinor': item.price.unitMinor,
          'items.$.currency': item.price.currency,
          'items.$.title': item.title,
          'items.$.variantLabel': item.variantLabel,
          'items.$.imageUrl': item.imageUrl,
          'items.$.updatedAt': now,
          lastActivityAt: now,
          updatedAt: now,
        },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (merged) {
      const cart = toDomain(merged as unknown as ICart);
      const line = cart.items.find((i) => i.sku === item.sku);
      if (line && line.quantity > 50) {
        await CartModel.findOneAndUpdate(
          { userId, 'items.itemId': line.itemId },
          { $set: { 'items.$.quantity': line.quantity - item.quantity }, $inc: { version: 1 } },
        ).exec();
        throw new Error('QUANTITY_EXCEEDS_MAX');
      }
      return { cart, created: false };
    }

    const pushed = await CartModel.findOneAndUpdate(
      {
        userId,
        status: 'active',
        ...versionFilter,
        'items.sku': { $ne: item.sku },
        'items.50': { $exists: false },
      },
      {
        $push: {
          items: {
            itemId: item.itemId,
            sku: item.sku,
            variantId: item.variantId,
            productId: item.productId,
            title: item.title,
            variantLabel: item.variantLabel,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            unitMinor: item.price.unitMinor,
            currency: item.price.currency,
            addedAt: item.addedAt,
            updatedAt: now,
          },
        },
        $inc: { version: 1 },
        $set: { lastActivityAt: now, updatedAt: now },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (pushed) return { cart: toDomain(pushed as unknown as ICart), created: true };

    const current = await this.getByUserId(userId);
    if (!current) throw new CartStaleError();
    if (expectedVersion !== null && current.version !== expectedVersion) {
      throw new CartStaleError();
    }
    if (current.items.some((i) => i.sku === item.sku)) {
      throw new CartStaleError('Concurrent add detected, retry to merge quantities');
    }
    throw new CartStaleError('Cart line limit exceeded or concurrent modification');
  }

  async updateQuantity(
    userId: string,
    itemId: string,
    quantity: number,
    expectedVersion: number,
  ): Promise<Cart> {
    const now = new Date();
    const doc = await CartModel.findOneAndUpdate(
      { userId, status: 'active', version: expectedVersion, 'items.itemId': itemId },
      {
        $set: {
          'items.$.quantity': quantity,
          'items.$.updatedAt': now,
          updatedAt: now,
          lastActivityAt: now,
        },
        $inc: { version: 1 },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (doc) return toDomain(doc as unknown as ICart);
    const current = await this.getByUserId(userId);
    if (!current || !current.items.some((i) => i.itemId === itemId)) {
      throw new CartItemNotFoundError();
    }
    throw new CartStaleError();
  }

  async removeItem(userId: string, itemId: string, expectedVersion: number | null): Promise<Cart> {
    const now = new Date();
    const filter: Record<string, unknown> = { userId, status: 'active' };
    if (expectedVersion !== null) filter.version = expectedVersion;
    const doc = await CartModel.findOneAndUpdate(
      { ...filter, 'items.itemId': itemId },
      {
        $pull: { items: { itemId } },
        $inc: { version: 1 },
        $set: { lastActivityAt: now, updatedAt: now },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (doc) return toDomain(doc as unknown as ICart);
    const current = await this.getByUserId(userId);
    if (!current) return this.getOrCreate(userId);
    if (!current.items.some((i) => i.itemId === itemId)) throw new CartItemNotFoundError();
    throw new CartStaleError();
  }

  async clear(userId: string, expectedVersion: number | null): Promise<Cart> {
    const now = new Date();
    const filter: Record<string, unknown> = { userId, status: 'active' };
    if (expectedVersion !== null) filter.version = expectedVersion;
    const doc = await CartModel.findOneAndUpdate(
      filter,
      { $set: { items: [], lastActivityAt: now, updatedAt: now }, $inc: { version: 1 } },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (doc) return toDomain(doc as unknown as ICart);
    const current = await this.getByUserId(userId);
    if (!current) return this.getOrCreate(userId);
    throw new CartStaleError();
  }

  async markConverted(userId: string): Promise<void> {
    await CartModel.findOneAndUpdate(
      { userId, status: 'active' },
      { $set: { status: 'converted', updatedAt: new Date() }, $inc: { version: 1 } },
    ).exec();
    this.logger.debug('Cart marked converted', { userId });
  }
}
