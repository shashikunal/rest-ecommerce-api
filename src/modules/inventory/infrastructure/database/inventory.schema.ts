import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IInventory {
  _id: string;
  sku: string;
  productId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  sold: number;
  lowStockThreshold: number;
  version: number;
  lastMovementAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<IInventory>(
  {
    _id: { type: String, default: () => uuidv4() },
    sku: { type: String, required: true, trim: true, uppercase: true },
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    onHand: { type: Number, required: true, min: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 },
    sold: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 5 },
    version: { type: Number, default: 0 },
    lastMovementAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'inventories' },
);

inventorySchema.index({ sku: 1 }, { unique: true, name: 'uq_inventory_sku' });
inventorySchema.index({ productId: 1, variantId: 1 }, { name: 'ix_inventory_product_variant' });

export const InventoryModel: Model<IInventory> = model<IInventory>(
  'ShopInventory',
  inventorySchema,
);
