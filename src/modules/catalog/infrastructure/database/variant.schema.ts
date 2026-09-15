import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IVariant {
  _id: string;
  productId: string;
  sku: string;
  barcode?: string;
  attrs: Record<string, string>;
  attrSignature: string;
  dims?: { length?: number; width?: number; height?: number; weight?: number };
  status: string;
  priceRef: { amountMinor: number; currency: string };
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<IVariant>(
  {
    _id: { type: String, default: () => uuidv4() },
    productId: { type: String, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true, maxlength: 64 },
    attrs: { type: Schema.Types.Mixed, required: true },
    attrSignature: { type: String, required: true },
    dims: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      weight: { type: Number, min: 0 },
    },
    status: {
      type: String,
      enum: ['active', 'discontinued'],
      default: 'active',
    },
    priceRef: {
      amountMinor: { type: Number, required: true, min: 0 },
      currency: { type: String, required: true, minlength: 3, maxlength: 3 },
    },
    version: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'productVariants' },
);

variantSchema.index({ sku: 1 }, { unique: true, name: 'uq_sku' });
variantSchema.index({ productId: 1 }, { name: 'ix_product' });
variantSchema.index({ productId: 1, attrSignature: 1 }, { unique: true, name: 'uq_product_attrs' });

export const VariantModel: Model<IVariant> = model<IVariant>('CatalogVariant', variantSchema);
