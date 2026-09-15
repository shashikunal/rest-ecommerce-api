import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IProduct {
  _id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  brandId?: string;
  attrs: Record<string, string>;
  media: Array<{
    mediaId: string;
    key: string;
    url: string;
    type: string;
    altText?: string;
    sortOrder: number;
    width?: number;
    height?: number;
    bytes?: number;
  }>;
  status: string;
  seo?: { title?: string; description?: string };
  minPrice?: { amountMinor: number; currency: string };
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const mediaRefSchema = new Schema(
  {
    mediaId: { type: String, required: true },
    key: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    altText: { type: String },
    sortOrder: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    bytes: { type: Number },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    _id: { type: String, default: () => uuidv4() },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, required: true, maxlength: 10000 },
    shortDescription: { type: String, maxlength: 500 },
    categoryId: { type: String, required: true },
    brandId: { type: String },
    attrs: { type: Schema.Types.Mixed, default: {} },
    media: { type: [mediaRefSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    seo: {
      title: { type: String, maxlength: 200 },
      description: { type: String, maxlength: 500 },
    },
    minPrice: {
      amountMinor: { type: Number },
      currency: { type: String },
    },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'products' },
);

productSchema.index({ slug: 1 }, { unique: true, name: 'uq_slug' });
productSchema.index({ categoryId: 1, 'minPrice.amountMinor': 1 }, { name: 'ix_cat_price' });
productSchema.index({ title: 'text', description: 'text' }, { name: 'txt_search' });

export const ProductModel: Model<IProduct> = model<IProduct>('CatalogProduct', productSchema);
