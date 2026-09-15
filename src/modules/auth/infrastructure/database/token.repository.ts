import type { Logger } from '@config/logger';

import type { TokenRepository, TokenRecord } from '../../domain/repositories/TokenRepository';

import { TokenModel } from './token.schema';

export class MongoTokenRepository implements TokenRepository {
  constructor(private readonly logger: Logger) {}

  async saveToken(record: TokenRecord): Promise<void> {
    const doc = new TokenModel({
      _id: record.id,
      userId: record.userId,
      token: record.token,
      tokenType: record.tokenType,
      isRevoked: record.isRevoked,
      isUsed: record.isUsed,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    });
    await doc.save();
    this.logger.debug('Token saved', { tokenId: record.id, tokenType: record.tokenType });
  }

  async findByToken(token: string): Promise<TokenRecord | null> {
    const doc = await TokenModel.findOne({ token }).exec();
    if (!doc) return null;
    return {
      id: doc._id,
      userId: doc.userId,
      token: doc.token,
      tokenType: doc.tokenType,
      isRevoked: doc.isRevoked,
      isUsed: doc.isUsed,
      expiresAt: doc.expiresAt,
      createdAt: doc.createdAt,
    };
  }

  async revokeToken(tokenId: string): Promise<void> {
    await TokenModel.findByIdAndUpdate(tokenId, { isRevoked: true }).exec();
    this.logger.debug('Token revoked', { tokenId });
  }

  async revokeAllUserTokens(userId: string, exceptTokenId?: string): Promise<void> {
    const filter: Record<string, unknown> = { userId, isRevoked: false };
    if (exceptTokenId) filter._id = { $ne: exceptTokenId };
    await TokenModel.updateMany(filter, { isRevoked: true }).exec();
    this.logger.debug('All user tokens revoked', { userId });
  }

  async isTokenRevoked(tokenId: string): Promise<boolean> {
    const doc = await TokenModel.findById(tokenId).exec();
    return doc ? doc.isRevoked : true;
  }

  async markTokenUsed(tokenId: string): Promise<void> {
    await TokenModel.updateOne({ _id: tokenId }, { isUsed: true }).exec();
    this.logger.debug('Token marked as used', { tokenId });
  }

  async deleteExpiredTokens(): Promise<void> {
    await TokenModel.deleteMany({ expiresAt: { $lt: new Date() } }).exec();
  }
}
