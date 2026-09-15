import { v4 as uuidv4 } from 'uuid';

export type CatalogEventType =
  | 'catalog.productCreated'
  | 'catalog.productUpdated'
  | 'catalog.productPublished'
  | 'catalog.productUnpublished'
  | 'catalog.variantCreated'
  | 'catalog.variantUpdated'
  | 'search.indexRequested'
  | 'search.indexUpdated'
  | 'search.indexRemoved';

export interface CatalogEventEnvelope {
  readonly eventId: string;
  readonly eventType: CatalogEventType;
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

export interface CatalogEventPublisher {
  publish(event: CatalogEventEnvelope): Promise<void>;
}

export function buildCatalogEvent(
  eventType: CatalogEventType,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  options: { correlationId?: string; causationId?: string | null; version?: number } = {},
): CatalogEventEnvelope {
  const version = options.version ?? 1;
  return {
    eventId: uuidv4(),
    eventType,
    eventVersion: version,
    occurredAt: new Date(),
    producer: 'catalog-svc',
    aggregateType,
    aggregateId,
    correlationId: options.correlationId ?? '',
    causationId: options.causationId ?? null,
    schemaVersion: version,
    payload,
  };
}

export type OutboxStatus = 'PENDING' | 'CLAIMED' | 'SENT';

export interface OutboxRecord {
  readonly id: string;
  readonly event: CatalogEventEnvelope;
  readonly topic: string;
  readonly status: OutboxStatus;
  readonly createdAt: Date;
}

export interface OutboxRepository {
  append(record: OutboxRecord): Promise<void>;
  claimPending(limit: number): Promise<OutboxRecord[]>;
  markSent(id: string): Promise<void>;
}
