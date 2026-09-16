import type { Logger } from '@config/logger';

import type { InventoryMovement } from '../../domain/entities/Inventory';
import type { MovementRepository } from '../../domain/repositories/InventoryRepository';

import { MovementModel, type IMovement } from './movement.schema';

function toDomain(doc: IMovement): InventoryMovement {
  return {
    id: String(doc._id),
    inventoryId: doc.inventoryId,
    sku: doc.sku,
    type: doc.type as InventoryMovement['type'],
    quantityDelta: doc.quantityDelta,
    previousOnHand: doc.previousOnHand,
    previousReserved: doc.previousReserved,
    newOnHand: doc.newOnHand,
    newReserved: doc.newReserved,
    reason: doc.reason,
    referenceType: doc.referenceType,
    referenceId: doc.referenceId,
    actorType: doc.actorType,
    actorId: doc.actorId,
    idempotencyKey: doc.idempotencyKey,
    correlationId: doc.correlationId,
    createdAt: doc.createdAt,
  };
}

function encodeCursor(createdAt: number, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');
}

function decodeCursor(raw: string): { createdAt: number; id: string } {
  const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as {
    createdAt: number;
    id: string;
  };
  if (typeof decoded.id !== 'string' || typeof decoded.createdAt !== 'number') {
    throw new Error('INVALID_CURSOR');
  }
  return decoded;
}

export class MongoMovementRepository implements MovementRepository {
  constructor(private readonly logger: Logger) {}

  async append(movement: InventoryMovement): Promise<void> {
    try {
      const doc = new MovementModel({
        _id: movement.id,
        inventoryId: movement.inventoryId,
        sku: movement.sku,
        type: movement.type,
        quantityDelta: movement.quantityDelta,
        previousOnHand: movement.previousOnHand,
        previousReserved: movement.previousReserved,
        newOnHand: movement.newOnHand,
        newReserved: movement.newReserved,
        reason: movement.reason,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        actorType: movement.actorType,
        actorId: movement.actorId,
        idempotencyKey: movement.idempotencyKey,
        correlationId: movement.correlationId,
      });
      await doc.save();
    } catch (error) {
      if (/duplicate|E11000/i.test((error as Error).message) && movement.idempotencyKey) {
        this.logger.debug('Duplicate movement ignored (idempotent replay)', {
          idempotencyKey: movement.idempotencyKey,
        });
        return;
      }
      throw error;
    }
  }

  async findByIdempotencyKey(key: string): Promise<InventoryMovement | null> {
    const doc = await MovementModel.findOne({ idempotencyKey: key }).select('-__v').lean().exec();
    return doc ? toDomain(doc as unknown as IMovement) : null;
  }

  async findByInventoryId(
    inventoryId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ movements: InventoryMovement[]; nextCursor: string | null }> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const filter: Record<string, unknown> = { inventoryId };
    if (cursor) {
      let decoded: { createdAt: number; id: string };
      try {
        decoded = decodeCursor(cursor);
      } catch {
        throw new Error('INVALID_CURSOR');
      }
      filter.$or = [
        { createdAt: { $lt: new Date(decoded.createdAt) } },
        { createdAt: new Date(decoded.createdAt), _id: { $lt: decoded.id } },
      ];
    }
    const docs = await MovementModel.find(filter)
      .select('-__v')
      .sort({ createdAt: -1, _id: -1 })
      .limit(safeLimit + 1)
      .lean()
      .exec();
    const page = docs.slice(0, safeLimit);
    const hasMore = docs.length > safeLimit;
    const last = page[page.length - 1] as unknown as IMovement | undefined;
    return {
      movements: page.map((d) => toDomain(d as unknown as IMovement)),
      nextCursor:
        hasMore && last ? encodeCursor(new Date(last.createdAt).getTime(), String(last._id)) : null,
    };
  }
}
