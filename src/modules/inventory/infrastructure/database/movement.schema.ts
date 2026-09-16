import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IMovement {
  _id: string;
  inventoryId: string;
  sku: string;
  type: string;
  quantityDelta: number;
  previousOnHand: number;
  previousReserved: number;
  newOnHand: number;
  newReserved: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string;
  actorId: string;
  idempotencyKey: string | null;
  correlationId: string;
  createdAt: Date;
}

const movementSchema = new Schema<IMovement>(
  {
    _id: { type: String, default: () => uuidv4() },
    inventoryId: { type: String, required: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    type: {
      type: String,
      enum: ['INIT', 'ADJUST', 'RESERVE', 'RELEASE', 'EXPIRE', 'CONFIRM'],
      required: true,
    },
    quantityDelta: { type: Number, required: true },
    previousOnHand: { type: Number, required: true, min: 0 },
    previousReserved: { type: Number, required: true, min: 0 },
    newOnHand: { type: Number, required: true, min: 0 },
    newReserved: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, maxlength: 64 },
    referenceType: { type: String, default: null, maxlength: 64 },
    referenceId: { type: String, default: null, maxlength: 128 },
    actorType: { type: String, required: true, maxlength: 32 },
    actorId: { type: String, required: true, maxlength: 128 },
    idempotencyKey: { type: String, default: null },
    correlationId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'inventory_movements' },
);

movementSchema.index({ inventoryId: 1, createdAt: -1 }, { name: 'ix_movement_inventory_created' });
movementSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, name: 'uq_movement_idem' },
);

export const MovementModel: Model<IMovement> = model<IMovement>(
  'ShopInventoryMovement',
  movementSchema,
);
