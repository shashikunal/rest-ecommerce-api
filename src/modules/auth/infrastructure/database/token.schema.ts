import { Schema, model, type Model, type Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IToken {
  _id: string;
  userId: string;
  token: string;
  tokenType: 'access' | 'refresh';
  isRevoked: boolean;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const tokenSchema = new Schema<IToken>(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true },
    token: { type: String, required: true },
    tokenType: { type: String, enum: ['access', 'refresh'], required: true },
    isRevoked: { type: Boolean, default: false },
    isUsed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'tokens' },
);

tokenSchema.index({ token: 1 }, { unique: true });
tokenSchema.index({ userId: 1, tokenType: 1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenModel: Model<IToken> = model<IToken>('Token', tokenSchema);
