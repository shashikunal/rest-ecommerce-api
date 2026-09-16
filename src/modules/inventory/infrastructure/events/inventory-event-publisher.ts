import type { Logger } from '@config/logger';
import { OutboxModel } from '@modules/catalog/infrastructure/database/outbox.schema';
import { v4 as uuidv4 } from 'uuid';

import {
  INVENTORY_EVENTS_TOPIC,
  type InventoryEventEnvelope,
  type InventoryEventPublisher,
} from '../../domain/events/InventoryEvents';

export class OutboxInventoryEventPublisher implements InventoryEventPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(event: InventoryEventEnvelope): Promise<void> {
    try {
      const doc = new OutboxModel({
        _id: uuidv4(),
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        topic: INVENTORY_EVENTS_TOPIC,
        status: 'PENDING',
        payload: event as unknown as Record<string, unknown>,
        createdAt: event.occurredAt,
      });
      await doc.save();
      this.logger.info('Inventory event queued', {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
      });
    } catch (error) {
      this.logger.warn('Inventory outbox append failed (non-blocking)', {
        error: (error as Error).message,
        eventType: event.eventType,
      });
    }
  }
}
