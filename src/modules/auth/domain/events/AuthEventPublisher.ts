import type { AuthEvent } from './AuthEvents';

export interface AuthEventPublisher {
  publish(event: AuthEvent): Promise<void>;
}
