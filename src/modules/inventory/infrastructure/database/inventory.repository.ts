import type { Logger } from '@config/logger';

import { deriveStockStatus } from '../../domain/entities/Inventory';
import type { Inventory } from '../../domain/entities/Inventory';
import type {
  AdjustmentOutcome,
  InventoryListOptions,
  InventoryListResult,
  InventoryRepository,
} from '../../domain/repositories/InventoryRepository';

import { InventoryModel, type IInventory } from './inventory.schema';

function toDomain(doc: IInventory): Inventory {
  return {
    id: String(doc._id),
    sku: doc.sku,
    productId: doc.productId,
    variantId: doc.variantId,
    onHand: doc.onHand,
    reserved: doc.reserved,
    sold: doc.sold,
    lowStockThreshold: doc.lowStockThreshold,
    version: doc.version ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastMovementAt: doc.lastMovementAt,
  };
}

function encodeCursor(sku: string): string {
  return Buffer.from(JSON.stringify({ sku })).toString('base64');
}

function decodeCursor(raw: string): string {
  const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as { sku: string };
  if (typeof decoded.sku !== 'string') throw new Error('INVALID_CURSOR');
  return decoded.sku;
}

export class MongoInventoryRepository implements InventoryRepository {
  constructor(private readonly logger: Logger) {}

  async findById(id: string): Promise<Inventory | null> {
    const doc = await InventoryModel.findById(id).select('-__v').lean().exec();
    return doc ? toDomain(doc as unknown as IInventory) : null;
  }

  async findBySku(sku: string): Promise<Inventory | null> {
    const doc = await InventoryModel.findOne({ sku: sku.trim().toUpperCase() })
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as IInventory) : null;
  }

  async create(record: Inventory): Promise<void> {
    const doc = new InventoryModel({
      _id: record.id,
      sku: record.sku,
      productId: record.productId,
      variantId: record.variantId,
      onHand: record.onHand,
      reserved: record.reserved,
      sold: record.sold,
      lowStockThreshold: record.lowStockThreshold,
      version: record.version,
      lastMovementAt: record.lastMovementAt,
    });
    await doc.save();
    this.logger.debug('Inventory created', { sku: record.sku });
  }

  async list(options: InventoryListOptions): Promise<InventoryListResult> {
    const limit = Math.min(Math.max(options.limit, 1), 50);
    const filter: Record<string, unknown> = {};
    if (options.sku) {
      filter.sku = options.sku.trim().toUpperCase();
    } else if (options.cursor) {
      let lastSku: string;
      try {
        lastSku = decodeCursor(options.cursor);
      } catch {
        throw new Error('INVALID_CURSOR');
      }
      filter.sku = { $gt: lastSku };
    }
    const docs = await InventoryModel.find(filter)
      .select('-__v')
      .sort({ sku: 1 })
      .limit(limit + 1)
      .lean()
      .exec();
    let records = docs.slice(0, limit).map((d) => toDomain(d as unknown as IInventory));
    const hasMore = docs.length > limit;
    if (options.status) {
      records = records.filter((r) => deriveStockStatus(r) === options.status);
    }
    const last = docs.slice(0, limit)[docs.slice(0, limit).length - 1];
    return {
      records,
      nextCursor: hasMore && last ? encodeCursor((last as unknown as IInventory).sku) : null,
    };
  }

  async applyAdjustment(skuOrId: string, delta: number): Promise<AdjustmentOutcome | null> {
    const now = new Date();
    const identity = { $or: [{ sku: skuOrId.trim().toUpperCase() }, { _id: skuOrId }] };
    const doc = await InventoryModel.findOneAndUpdate(
      {
        ...identity,
        $expr: {
          $and: [
            { $gte: [{ $add: ['$onHand', delta] }, '$reserved'] },
            { $gte: [{ $add: ['$onHand', delta] }, 0] },
          ],
        },
      },
      {
        $inc: { onHand: delta, version: 1 },
        $set: { updatedAt: now, lastMovementAt: now },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    if (!doc) return null;
    const record = toDomain(doc as unknown as IInventory);
    return {
      record,
      previousOnHand: record.onHand - delta,
      previousReserved: record.reserved,
    };
  }

  async reserveStock(sku: string, quantity: number): Promise<Inventory | null> {
    const now = new Date();
    const doc = await InventoryModel.findOneAndUpdate(
      {
        sku: sku.trim().toUpperCase(),
        $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, quantity] },
      },
      {
        $inc: { reserved: quantity, version: 1 },
        $set: { updatedAt: now, lastMovementAt: now },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as IInventory) : null;
  }

  async releaseStock(sku: string, quantity: number): Promise<Inventory | null> {
    const now = new Date();
    const doc = await InventoryModel.findOneAndUpdate(
      { sku: sku.trim().toUpperCase(), reserved: { $gte: quantity } },
      {
        $inc: { reserved: -quantity, version: 1 },
        $set: { updatedAt: now, lastMovementAt: now },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as IInventory) : null;
  }

  async commitStock(sku: string, quantity: number): Promise<Inventory | null> {
    const now = new Date();
    const doc = await InventoryModel.findOneAndUpdate(
      { sku: sku.trim().toUpperCase(), reserved: { $gte: quantity } },
      {
        $inc: { reserved: -quantity, onHand: -quantity, sold: quantity, version: 1 },
        $set: { updatedAt: now, lastMovementAt: now },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as IInventory) : null;
  }
}
