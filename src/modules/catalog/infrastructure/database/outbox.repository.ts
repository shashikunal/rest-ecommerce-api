import type { Logger } from '@config/logger';
import { v4 as uuidv4 } from 'uuid';

import type {
  CatalogEventEnvelope,
  OutboxRecord,
  OutboxRepository,
} from '../../domain/events/CatalogEvents';

import { OutboxModel } from './outbox.schema';

export class MongoOutboxRepository implements OutboxRepository {
  constructor(private readonly logger: Logger) {}

  async append(record: OutboxRecord): Promise<void> {
    try {
      const doc = new OutboxModel({
        _id: uuidv4(),
        eventId: record.event.eventId,
        eventType: record.event.eventType,
        aggregateType: record.event.aggregateType,
        aggregateId: record.event.aggregateId,
        topic: record.topic,
        status: 'PENDING',
        payload: record.event as unknown as Record<string, unknown>,
        createdAt: record.createdAt,
      });
      await doc.save();
    } catch (error) {
      this.logger.warn('Outbox append failed (non-blocking)', {
        error: (error as Error).message,
      });
    }
  }

  async claimPending(limit: number): Promise<OutboxRecord[]> {
    const docs = await OutboxModel.find({ status: 'PENDING' })
      .sort({ createdAt: 1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();
    const claimed: OutboxRecord[] = [];
    for (const doc of docs) {
      const updated = await OutboxModel.findOneAndUpdate(
        { _id: doc._id, status: 'PENDING' },
        { status: 'CLAIMED' },
      )
        .lean()
        .exec();
      if (updated) {
        claimed.push({
          id: String(doc._id),
          event: doc.payload as unknown as CatalogEventEnvelope,
          topic: doc.topic,
          status: 'CLAIMED',
          createdAt: doc.createdAt,
        });
      }
    }
    return claimed;
  }

  async markSent(id: string): Promise<void> {
    await OutboxModel.findByIdAndUpdate(id, { status: 'SENT' }).exec();
  }
}
