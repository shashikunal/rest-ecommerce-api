import { Schema, model, type Model, type Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ISession {
  _id: string;
  userId: string;
  tokenId: string;
  refreshTokenId?: string;
  userAgent: string;
  ipAddress: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true },
    tokenId: { type: String, required: true },
    refreshTokenId: { type: String, required: false },
    userAgent: { type: String, required: true },
    ipAddress: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'sessions' },
);

sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ tokenId: 1 }, { unique: true });
sessionSchema.index({ refreshTokenId: 1 }, { sparse: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel: Model<ISession> = model<ISession>('Session', sessionSchema);
