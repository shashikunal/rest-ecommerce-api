import { Schema, model, type Model, type Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneVerified?: boolean;
  status?: string;
  preferences?: Record<string, unknown>;
  version?: number;
  deletedAt?: Date | null;
  isEmailVerified: boolean;
  isActive: boolean;
  roles: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => uuidv4() },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20 },
    phoneVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'],
      default: 'ACTIVE',
    },
    preferences: { type: Schema.Types.Mixed, default: undefined },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    roles: { type: [String], default: ['user'] },
    lastLoginAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1 });

export const UserModel: Model<IUser> = model<IUser>('User', userSchema);
