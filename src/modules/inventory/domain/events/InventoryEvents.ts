import { v4 as uuidv4 } from 'uuid';

export type InventoryEventType =
  | 'inventory.adjusted'
  | 'inventory.reserved'
  | 'inventory.released'
  | 'inventory.committed'
  | 'inventory.lowStock';

export const INVENTORY_EVENTS_TOPIC = 'commerce.inventory.events.v1';

export interface InventoryEventEnvelope {
  readonly eventId: string;
  readonly eventType: InventoryEventType;
  readonly eventVersion: number;
  readonly occurredAt: Date;
  readonly producer: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly schemaVersion: number;
  readonly payload: Record<string, unknown>;
}

export interface InventoryEventPublisher {
  publish(event: InventoryEventEnvelope): Promise<void>;
}

export function buildInventoryEvent(
  eventType: InventoryEventType,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  options: { correlationId?: string; causationId?: string | null; version?: number } = {},
): InventoryEventEnvelope {
  const version = options.version ?? 1;
  return {
    eventId: uuidv4(),
    eventType,
    eventVersion: version,
    occurredAt: new Date(),
    producer: 'inventory-svc',
    aggregateType,
    aggregateId,
    correlationId: options.correlationId ?? '',
    causationId: options.causationId ?? null,
    schemaVersion: version,
    payload,
  };
}
