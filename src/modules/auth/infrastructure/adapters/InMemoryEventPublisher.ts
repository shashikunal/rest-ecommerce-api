import type { Logger } from '@config/logger';

import type { AuthEventPublisher } from '../../domain/events/AuthEventPublisher';
import type { AuthEvent } from '../../domain/events/AuthEvents';

export class InMemoryEventPublisher implements AuthEventPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(event: AuthEvent): Promise<void> {
    this.logger.info('Auth event published', { type: event.type, userId: event.userId });
  }
}
