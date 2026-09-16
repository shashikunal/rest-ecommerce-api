import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IReservation {
  _id: string;
  inventoryId: string;
  sku: string;
  productId: string;
  variantId: string;
  quantity: number;
  status: string;
  referenceType: string;
  referenceId: string;
  idemKey: string | null;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    _id: { type: String, default: () => uuidv4() },
    inventoryId: { type: String, required: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['active', 'released', 'expired', 'confirmed'],
      default: 'active',
    },
    referenceType: { type: String, required: true, maxlength: 64 },
    referenceId: { type: String, required: true, maxlength: 128 },
    idemKey: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    version: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'inventory_reservations' },
);

reservationSchema.index(
  { idemKey: 1 },
  { unique: true, sparse: true, name: 'uq_reservation_idem' },
);
reservationSchema.index({ sku: 1, status: 1 }, { name: 'ix_reservation_sku_status' });
reservationSchema.index({ status: 1, expiresAt: 1 }, { name: 'ix_reservation_status_expiry' });
reservationSchema.index({ referenceType: 1, referenceId: 1 }, { name: 'ix_reservation_reference' });

export const ReservationModel: Model<IReservation> = model<IReservation>(
  'ShopReservation',
  reservationSchema,
);
