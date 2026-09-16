import type { Logger } from '@config/logger';

import type { Checkout, CheckoutStatus } from '../../domain/entities/Checkout';
import type {
  CheckoutListOptions,
  CheckoutListResult,
  CheckoutRepository,
} from '../../domain/repositories/CheckoutRepository';

import { CheckoutModel, type ICheckout } from './checkout.schema';

function toDomain(doc: ICheckout): Checkout {
  return {
    id: String(doc._id),
    userId: doc.userId,
    cartId: doc.cartId,
    cartVersion: doc.cartVersion,
    status: doc.status as Checkout['status'],
    items: (doc.items ?? []).map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      sku: i.sku,
      title: i.title,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitMinor: i.unitMinor,
      currency: i.currency,
      lineTotalMinor: i.lineTotalMinor,
    })),
    shippingAddress: { ...doc.shippingAddress },
    billingAddress: { ...doc.billingAddress },
    pricing: {
      subtotalMinor: doc.subtotalMinor,
      discountMinor: doc.discountMinor,
      shippingMinor: doc.shippingMinor,
      taxMinor: doc.taxMinor,
      grandTotalMinor: doc.grandTotalMinor,
      currency: doc.currency,
      couponCode: doc.couponCode,
    },
    currency: doc.currency,
    customer: {
      userId: doc.customerUserId,
      email: doc.customerEmail,
      name: doc.customerName,
    },
    reservations: (doc.reservations ?? []).map((r) => ({ ...r })),
    idempotencyKey: doc.idempotencyKey,
    reqHash: doc.reqHash,
    failReason: doc.failReason,
    orderId: doc.orderId,
    version: doc.version ?? 0,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
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

export class MongoCheckoutRepository implements CheckoutRepository {
  constructor(private readonly logger: Logger) {}

  async create(checkout: Checkout): Promise<void> {
    const doc = new CheckoutModel({
      _id: checkout.id,
      userId: checkout.userId,
      cartId: checkout.cartId,
      cartVersion: checkout.cartVersion,
      status: checkout.status,
      items: checkout.items,
      shippingAddress: { ...checkout.shippingAddress },
      billingAddress: { ...checkout.billingAddress },
      subtotalMinor: checkout.pricing.subtotalMinor,
      discountMinor: checkout.pricing.discountMinor,
      shippingMinor: checkout.pricing.shippingMinor,
      taxMinor: checkout.pricing.taxMinor,
      grandTotalMinor: checkout.pricing.grandTotalMinor,
      currency: checkout.currency,
      couponCode: checkout.pricing.couponCode,
      customerUserId: checkout.customer.userId,
      customerEmail: checkout.customer.email,
      customerName: checkout.customer.name,
      reservations: checkout.reservations,
      idempotencyKey: checkout.idempotencyKey,
      reqHash: checkout.reqHash,
      failReason: checkout.failReason,
      orderId: checkout.orderId,
      version: checkout.version,
      expiresAt: checkout.expiresAt,
    });
    await doc.save();
    this.logger.debug('Checkout created', { checkoutId: checkout.id });
  }

  async findById(id: string): Promise<Checkout | null> {
    const doc = await CheckoutModel.findById(id).select('-__v').lean().exec();
    return doc ? toDomain(doc as unknown as ICheckout) : null;
  }

  async findByUserAndKey(userId: string, idempotencyKey: string): Promise<Checkout | null> {
    const doc = await CheckoutModel.findOne({ userId, idempotencyKey })
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as ICheckout) : null;
  }

  async listByUser(userId: string, options: CheckoutListOptions): Promise<CheckoutListResult> {
    const safeLimit = Math.min(Math.max(options.limit, 1), 50);
    const filter: Record<string, unknown> = { userId };
    if (options.cursor) {
      let decoded: { createdAt: number; id: string };
      try {
        decoded = decodeCursor(options.cursor);
      } catch {
        throw new Error('INVALID_CURSOR');
      }
      filter.$or = [
        { createdAt: { $lt: new Date(decoded.createdAt) } },
        { createdAt: new Date(decoded.createdAt), _id: { $lt: decoded.id } },
      ];
    }
    const docs = await CheckoutModel.find(filter)
      .select('-__v')
      .sort({ createdAt: -1, _id: -1 })
      .limit(safeLimit + 1)
      .lean()
      .exec();
    const page = docs.slice(0, safeLimit);
    const hasMore = docs.length > safeLimit;
    const last = page[page.length - 1] as unknown as ICheckout | undefined;
    return {
      checkouts: page.map((d) => toDomain(d as unknown as ICheckout)),
      nextCursor:
        hasMore && last ? encodeCursor(new Date(last.createdAt).getTime(), String(last._id)) : null,
    };
  }

  async transition(
    id: string,
    from: CheckoutStatus[],
    to: CheckoutStatus,
    expectedVersion?: number,
  ): Promise<Checkout | null> {
    const filter: Record<string, unknown> = { _id: id, status: { $in: from } };
    if (expectedVersion !== undefined) filter.version = expectedVersion;
    const doc = await CheckoutModel.findOneAndUpdate(
      filter,
      { $set: { status: to, updatedAt: new Date() }, $inc: { version: 1 } },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as ICheckout) : null;
  }

  async setReservations(
    id: string,
    reservations: Checkout['reservations'],
    expectedVersion: number,
  ): Promise<Checkout | null> {
    const doc = await CheckoutModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: { reservations, updatedAt: new Date() }, $inc: { version: 1 } },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as ICheckout) : null;
  }

  async updateAddress(
    id: string,
    shipping: Checkout['shippingAddress'],
    billing: Checkout['billingAddress'],
    expectedVersion: number,
  ): Promise<Checkout | null> {
    const doc = await CheckoutModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      {
        $set: {
          shippingAddress: { ...shipping },
          billingAddress: { ...billing },
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as ICheckout) : null;
  }

  async markFailed(id: string, reason: string, expectedVersion?: number): Promise<Checkout | null> {
    const filter: Record<string, unknown> = { _id: id };
    if (expectedVersion !== undefined) filter.version = expectedVersion;
    const doc = await CheckoutModel.findOneAndUpdate(
      filter,
      {
        $set: { status: 'failed', failReason: reason, updatedAt: new Date() },
        $inc: { version: 1 },
      },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as ICheckout) : null;
  }

  async markCompleted(
    id: string,
    orderId: string,
    expectedVersion?: number,
  ): Promise<Checkout | null> {
    const filter: Record<string, unknown> = { _id: id, status: 'ready' };
    if (expectedVersion !== undefined) filter.version = expectedVersion;
    const doc = await CheckoutModel.findOneAndUpdate(
      filter,
      { $set: { status: 'completed', orderId, updatedAt: new Date() }, $inc: { version: 1 } },
      { new: true },
    )
      .select('-__v')
      .lean()
      .exec();
    return doc ? toDomain(doc as unknown as ICheckout) : null;
  }

  async findActiveExpired(now: Date, limit: number): Promise<Checkout[]> {
    const docs = await CheckoutModel.find({
      status: { $in: ['priced', 'reserved', 'ready'] },
      expiresAt: { $lte: now },
    })
      .select('-__v')
      .sort({ expiresAt: 1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .lean()
      .exec();
    return docs.map((d) => toDomain(d as unknown as ICheckout));
  }
}
