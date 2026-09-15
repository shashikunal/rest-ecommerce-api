import type { Logger } from '@config/logger';
import { v4 as uuidv4 } from 'uuid';

import type { SessionRepository, Session } from '../../domain/repositories/SessionRepository';

import { SessionModel } from './session.schema';

export class MongoSessionRepository implements SessionRepository {
  constructor(private readonly logger: Logger) {}

  async create(session: Session): Promise<void> {
    const doc = new SessionModel({
      _id: session.id,
      userId: session.userId,
      tokenId: session.tokenId,
      refreshTokenId: session.refreshTokenId,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      isActive: session.isActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
    });
    await doc.save();
    this.logger.debug('Session created', { sessionId: session.id, userId: session.userId });
  }

  async findById(id: string): Promise<Session | null> {
    const doc = await SessionModel.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTokenId(tokenId: string): Promise<Session | null> {
    const doc = await SessionModel.findOne({ tokenId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByRefreshTokenId(refreshTokenId: string): Promise<Session | null> {
    const doc = await SessionModel.findOne({ refreshTokenId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    const docs = await SessionModel.find({ userId, isActive: true }).sort({ createdAt: -1 }).exec();
    return docs.map((d) => this.toDomain(d));
  }

  async findActiveByUserIdPaginated(
    userId: string,
    options: { limit: number; cursor?: string | null },
  ): Promise<{ sessions: Session[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(options.limit, 1), 50);
    const filter: Record<string, unknown> = { userId, isActive: true };
    if (options.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(options.cursor, 'base64').toString('utf-8')) as {
          createdAt: string;
          id: string;
        };
        const cursorDate = new Date(decoded.createdAt);
        if (!Number.isNaN(cursorDate.getTime()) && typeof decoded.id === 'string') {
          filter.$or = [
            { createdAt: { $lt: cursorDate } },
            { createdAt: cursorDate, _id: { $lt: decoded.id } },
          ];
        }
      } catch {
        // Invalid cursor is rejected at the validation layer; treat as first page here.
      }
    }
    const docs = await SessionModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();
    const page = docs.slice(0, limit);
    const hasMore = docs.length > limit;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last._id })).toString(
            'base64',
          )
        : null;
    return { sessions: page.map((d) => this.toDomain(d)), nextCursor };
  }

  async revokeById(id: string): Promise<void> {
    await SessionModel.findByIdAndUpdate(id, { isActive: false }).exec();
    this.logger.debug('Session revoked', { sessionId: id });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await SessionModel.updateMany({ userId, isActive: true }, { isActive: false }).exec();
    this.logger.debug('All sessions revoked for user', { userId });
  }

  async revokeAllExcept(userId: string, exceptSessionId: string): Promise<number> {
    const result = await SessionModel.updateMany(
      { userId, isActive: true, _id: { $ne: exceptSessionId } },
      { isActive: false },
    ).exec();
    this.logger.debug('Other sessions revoked for user', {
      userId,
      revokedCount: result.modifiedCount,
    });
    return result.modifiedCount ?? 0;
  }

  async revokeExpired(): Promise<void> {
    await SessionModel.updateMany(
      { expiresAt: { $lt: new Date() }, isActive: true },
      { isActive: false },
    ).exec();
  }

  async isTokenReused(tokenId: string): Promise<boolean> {
    const doc = await SessionModel.findOne({ tokenId });
    return doc ? !doc.isActive : false;
  }

  async markTokenUsed(tokenId: string): Promise<void> {
    await SessionModel.updateOne({ tokenId }, { isActive: false }).exec();
    this.logger.debug('Token marked as used', { tokenId });
  }

  private toDomain(doc: any): Session {
    return {
      id: doc._id,
      userId: doc.userId,
      tokenId: doc.tokenId,
      refreshTokenId: doc.refreshTokenId,
      userAgent: doc.userAgent,
      ipAddress: doc.ipAddress,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      lastActivityAt: doc.lastActivityAt,
    };
  }
}
