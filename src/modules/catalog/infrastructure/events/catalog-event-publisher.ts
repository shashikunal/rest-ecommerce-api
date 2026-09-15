import type { Logger } from '@config/logger';
import { v4 as uuidv4 } from 'uuid';

import type {
  CatalogEventEnvelope,
  CatalogEventPublisher,
  OutboxRepository,
} from '../../domain/events/CatalogEvents';

export class OutboxCatalogEventPublisher implements CatalogEventPublisher {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly logger: Logger,
  ) {}

  async publish(event: CatalogEventEnvelope): Promise<void> {
    const topic = event.eventType.startsWith('search.')
      ? 'commerce.search.events.v1'
      : 'commerce.catalog.events.v1';
    await this.outbox.append({
      id: uuidv4(),
      event,
      topic,
      status: 'PENDING',
      createdAt: new Date(),
    });
    this.logger.info('Catalog event recorded to outbox', {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      topic,
    });
  }
}
