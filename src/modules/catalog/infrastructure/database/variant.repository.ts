import type { Logger } from '@config/logger';

import type { Variant } from '../../domain/entities/Variant';
import type { VariantRepository } from '../../domain/repositories/VariantRepository';

import { VariantModel } from './variant.schema';

export class MongoVariantRepository implements VariantRepository {
  constructor(private readonly logger: Logger) {}

  async create(variant: Variant): Promise<void> {
    const doc = new VariantModel({
      _id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      barcode: variant.barcode,
      attrs: variant.attrs,
      attrSignature: variant.attrSignature,
      dims: variant.dims,
      status: variant.status,
      priceRef: variant.priceRef,
      version: variant.version,
    });
    await doc.save();
    this.logger.debug('Variant created', { variantId: variant.id, sku: variant.sku });
  }

  async findById(id: string): Promise<Variant | null> {
    const doc = await VariantModel.findById(id).select('-__v').lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findBySku(sku: string): Promise<Variant | null> {
    const doc = await VariantModel.findOne({ sku: sku.trim().toUpperCase() })
      .select('-__v')
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findActiveByProduct(productId: string): Promise<Variant[]> {
    const docs = await VariantModel.find({ productId, status: 'active' })
      .select('-__v')
      .lean()
      .exec();
    return docs.map((d) => this.toDomain(d));
  }

  async findAllByProduct(productId: string): Promise<Variant[]> {
    const docs = await VariantModel.find({ productId }).select('-__v').lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  async update(id: string, updates: Partial<Variant>): Promise<void> {
    const allowed: Record<string, unknown> = {};
    if (updates.barcode !== undefined) allowed.barcode = updates.barcode;
    if (updates.dims !== undefined) allowed.dims = updates.dims;
    if (updates.status !== undefined) allowed.status = updates.status;
    if (updates.priceRef !== undefined) allowed.priceRef = updates.priceRef;
    if (updates.version !== undefined) allowed.version = updates.version;
    allowed.updatedAt = new Date();
    await VariantModel.findByIdAndUpdate(id, allowed).exec();
    this.logger.debug('Variant updated', { variantId: id });
  }

  async remove(id: string): Promise<void> {
    await VariantModel.findByIdAndDelete(id).exec();
    this.logger.debug('Variant removed', { variantId: id });
  }

  async existsBySignature(
    productId: string,
    attrSignature: string,
    exceptId?: string,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = { productId, attrSignature };
    if (exceptId) filter._id = { $ne: exceptId };
    const count = await VariantModel.countDocuments(filter).exec();
    return count > 0;
  }

  async countActiveByProduct(productId: string): Promise<number> {
    return VariantModel.countDocuments({ productId, status: 'active' }).exec();
  }

  private toDomain(doc: Record<string, unknown>): Variant {
    const d = doc as unknown as {
      _id: string;
      productId: string;
      sku: string;
      barcode?: string;
      attrs: Record<string, string>;
      attrSignature: string;
      dims?: Variant['dims'];
      status: Variant['status'];
      priceRef: Variant['priceRef'];
      version: number;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: String(d._id),
      productId: d.productId,
      sku: d.sku,
      barcode: d.barcode,
      attrs: d.attrs ?? {},
      attrSignature: d.attrSignature,
      dims: d.dims,
      status: d.status,
      priceRef: d.priceRef,
      version: d.version ?? 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
