import { Schema, model, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IOutboxEvent {
  _id: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  topic: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

const outboxSchema = new Schema<IOutboxEvent>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true },
    topic: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CLAIMED', 'SENT'],
      default: 'PENDING',
    },
    payload: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'outbox_events' },
);

outboxSchema.index({ eventId: 1 }, { unique: true, name: 'uq_event' });
outboxSchema.index({ status: 1, createdAt: 1 }, { name: 'ix_status_created' });

export const OutboxModel: Model<IOutboxEvent> = model<IOutboxEvent>('CatalogOutbox', outboxSchema);
