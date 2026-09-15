import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  parentId: string | null;
  path: string;
  sortOrder: number;
  status: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    _id: { type: String, default: () => uuidv4() },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, maxlength: 2000 },
    parentId: { type: String, default: null },
    path: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'categories' },
);

categorySchema.index({ slug: 1 }, { unique: true, name: 'uq_slug' });
categorySchema.index({ parentId: 1 }, { name: 'ix_parent' });

export const CategoryModel: Model<ICategory> = model<ICategory>('CatalogCategory', categorySchema);

export interface IBrand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: { key: string; url: string };
  status: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    _id: { type: String, default: () => uuidv4() },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, maxlength: 2000 },
    logo: {
      key: { type: String },
      url: { type: String },
    },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'brands' },
);

brandSchema.index({ slug: 1 }, { unique: true, name: 'uq_slug' });

export const BrandModel: Model<IBrand> = model<IBrand>('CatalogBrand', brandSchema);
