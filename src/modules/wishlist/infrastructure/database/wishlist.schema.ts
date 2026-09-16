import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IWishlistItem {
  itemId: string;
  productId: string;
  variantId: string | null;
  sku: string;
  addedAt: Date;
}

export interface IWishlist {
  _id: string;
  userId: string;
  version: number;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const wishlistItemSchema = new Schema<IWishlistItem>(
  {
    itemId: { type: String, required: true },
    productId: { type: String, required: true },
    variantId: { type: String, default: null },
    sku: { type: String, required: true, uppercase: true, trim: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const wishlistSchema = new Schema<IWishlist>(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true },
    version: { type: Number, default: 0 },
    items: { type: [wishlistItemSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'wishlists' },
);

wishlistSchema.index({ userId: 1 }, { unique: true, name: 'uq_wishlist_user' });

export const WishlistModel: Model<IWishlist> = model<IWishlist>('ShopWishlist', wishlistSchema);
