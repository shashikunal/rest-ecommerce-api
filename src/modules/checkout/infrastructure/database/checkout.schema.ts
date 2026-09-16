import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICheckoutAddress {
  fullName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface ICheckoutItem {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantLabel: string | null;
  quantity: number;
  unitMinor: number;
  currency: string;
  lineTotalMinor: number;
}

export interface ICheckoutReservation {
  reservationId: string;
  sku: string;
  quantity: number;
}

export interface ICheckout {
  _id: string;
  userId: string;
  cartId: string;
  cartVersion: number;
  status: string;
  items: ICheckoutItem[];
  shippingAddress: ICheckoutAddress;
  billingAddress: ICheckoutAddress;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  grandTotalMinor: number;
  currency: string;
  couponCode: string | null;
  customerUserId: string;
  customerEmail: string;
  customerName: string;
  reservations: ICheckoutReservation[];
  idempotencyKey: string | null;
  reqHash: string | null;
  failReason: string | null;
  orderId: string | null;
  version: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<ICheckoutAddress>(
  {
    fullName: { type: String, required: true, maxlength: 120 },
    phone: { type: String, default: null, maxlength: 32 },
    line1: { type: String, required: true, maxlength: 200 },
    line2: { type: String, default: null, maxlength: 200 },
    city: { type: String, required: true, maxlength: 120 },
    region: { type: String, required: true, maxlength: 120 },
    postalCode: { type: String, required: true, maxlength: 32 },
    country: { type: String, required: true, minlength: 2, maxlength: 2 },
  },
  { _id: false },
);

const itemSchema = new Schema<ICheckoutItem>(
  {
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, maxlength: 200 },
    variantLabel: { type: String, default: null, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1, max: 50 },
    unitMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, minlength: 3, maxlength: 3 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const reservationRefSchema = new Schema<ICheckoutReservation>(
  {
    reservationId: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const checkoutSchema = new Schema<ICheckout>(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true },
    cartId: { type: String, required: true },
    cartVersion: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['priced', 'reserved', 'ready', 'completed', 'failed', 'expired', 'cancelled'],
      default: 'priced',
    },
    items: { type: [itemSchema], default: [] },
    shippingAddress: { type: addressSchema, required: true },
    billingAddress: { type: addressSchema, required: true },
    subtotalMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, required: true, min: 0, default: 0 },
    shippingMinor: { type: Number, required: true, min: 0, default: 0 },
    taxMinor: { type: Number, required: true, min: 0, default: 0 },
    grandTotalMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, minlength: 3, maxlength: 3 },
    couponCode: { type: String, default: null, maxlength: 64 },
    customerUserId: { type: String, required: true },
    customerEmail: { type: String, required: true, maxlength: 320 },
    customerName: { type: String, required: true, maxlength: 200 },
    reservations: { type: [reservationRefSchema], default: [] },
    idempotencyKey: { type: String, default: null },
    reqHash: { type: String, default: null },
    failReason: { type: String, default: null, maxlength: 200 },
    orderId: { type: String, default: null, maxlength: 128 },
    version: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'checkouts' },
);

checkoutSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true, name: 'uq_checkout_user_idem' },
);
checkoutSchema.index({ userId: 1, createdAt: -1 }, { name: 'ix_checkout_user_created' });
checkoutSchema.index({ cartId: 1 }, { name: 'ix_checkout_cart' });
checkoutSchema.index({ status: 1, expiresAt: 1 }, { name: 'ix_checkout_status_expiry' });

export const CheckoutModel: Model<ICheckout> = model<ICheckout>('ShopCheckout', checkoutSchema);
