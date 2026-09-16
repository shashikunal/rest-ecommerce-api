import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICartItem {
  itemId: string;
  sku: string;
  variantId: string;
  productId: string;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  quantity: number;
  unitMinor: number;
  currency: string;
  addedAt: Date;
  updatedAt: Date;
}

export interface ICart {
  _id: string;
  userId: string;
  status: string;
  version: number;
  items: ICartItem[];
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    itemId: { type: String, required: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    variantId: { type: String, required: true },
    productId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    variantLabel: { type: String, default: null, maxlength: 200 },
    imageUrl: { type: String, default: null, maxlength: 1000 },
    quantity: { type: Number, required: true, min: 1, max: 50 },
    unitMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, minlength: 3, maxlength: 3 },
    addedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const cartSchema = new Schema<ICart>(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true },
    status: { type: String, enum: ['active', 'converted', 'expired'], default: 'active' },
    version: { type: Number, default: 0 },
    items: { type: [cartItemSchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'carts' },
);

cartSchema.index({ userId: 1 }, { unique: true, name: 'uq_cart_user' });
cartSchema.index({ status: 1, lastActivityAt: 1 }, { name: 'ix_cart_status_activity' });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_cart_expiry' });

export const CartModel: Model<ICart> = model<ICart>('ShopCart', cartSchema);
