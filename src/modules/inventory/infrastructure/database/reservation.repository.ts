import type { Logger } from '@config/logger';

import type { Reservation, ReservationStatus } from '../../domain/entities/Inventory';
import type { ReservationRepository } from '../../domain/repositories/InventoryRepository';

import { ReservationModel, type IReservation } from './reservation.schema';

function toDomain(doc: IReservation): Reservation {
  return {
    id: String(doc._id),
    inventoryId: doc.inventoryId,
    sku: doc.sku,
    productId: doc.productId,
    variantId: doc.variantId,
    quantity: doc.quantity,
    status: doc.status as Reservation['status'],
    referenceType: doc.referenceType,
    referenceId: doc.referenceId,
    idempotencyKey: doc.idemKey,
    expiresAt: doc.expiresAt,
    version: doc.version ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoReservationRepository implements ReservationRepository {
  constructor(private readonly logger: Logger) {}

  async findById(id: string): Promise<Reservation | null> {
    const doc = await ReservationModel.findById(id).select('-__v').lean().exec();
    return doc ? toDomain(doc as unknown as IReservation) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Reservation | null> {
    const doc = await ReservationModel.findOne({ idemKey: key }).select('-__v').lean().exec();
    return doc ? toDomain(doc as unknown as IReservation) : null;
  }

  async create(reservation: Reservation): Promise<void> {
    const doc = new ReservationModel({
      _id: reservation.id,
      inventoryId: reservation.inventoryId,
      sku: reservation.sku,
      productId: reservation.productId,
      variantId: reservation.variantId,
      quantity: reservation.quantity,
      status: reservation.status,
      referenceType: reservation.referenceType,
      referenceId: reservation.referenceId,
      idemKey: reservation.idempotencyKey,
      expiresAt: reservation.expiresAt,
      version: reservation.version,
    });
    await doc.save();
    this.logger.debug('Reservation created', {
      reservationId: reservation.id,
      sku: reservation.sku,
    });
  }

  async transition(
    id: string,
    from: ReservationStatus[],
    to: ReservationStatus,
  ): Promise<Reservation | null> {
    const doc = await ReservationModel.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: { status: to, updatedAt: new Date() }, $inc: { version: 1 } },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as IReservation) : null;
  }

  async findActiveExpired(now: Date, limit: number): Promise<Reservation[]> {
    const docs = await ReservationModel.find({ status: 'active', expiresAt: { $lte: now } })
      .select('-__v')
      .sort({ expiresAt: 1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .lean()
      .exec();
    return docs.map((d) => toDomain(d as unknown as IReservation));
  }
}
