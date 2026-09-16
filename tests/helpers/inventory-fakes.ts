import { randomUUID } from 'crypto';

import type {
  Inventory,
  InventoryMovement,
  Reservation,
} from '@modules/inventory/domain/entities/Inventory';
import type { ReservationStatus } from '@modules/inventory/domain/entities/Inventory';
import type {
  InventoryEventEnvelope,
  InventoryEventPublisher,
} from '@modules/inventory/domain/events/InventoryEvents';
import type {
  AdjustmentOutcome,
  CatalogVariantRef,
  InventoryCatalogPort,
  InventoryListOptions,
  InventoryListResult,
  InventoryRepository,
  MovementRepository,
  ReservationRepository,
} from '@modules/inventory/domain/repositories/InventoryRepository';

export const INV_PROD_ID = '123e4567-e89b-42d3-a456-426614174013';
export const INV_VAR_ID = '123e4567-e89b-42d3-a456-426614174014';

export function makeInventory(overrides: Partial<Inventory> = {}): Inventory {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: randomUUID(),
    sku: 'SKU-001',
    productId: INV_PROD_ID,
    variantId: INV_VAR_ID,
    onHand: 100,
    reserved: 0,
    sold: 0,
    lowStockThreshold: 5,
    version: 0,
    createdAt: now,
    updatedAt: now,
    lastMovementAt: now,
    ...overrides,
  };
}

export class FakeInventoryRepository implements InventoryRepository {
  readonly store = new Map<string, Inventory>();

  async findById(id: string): Promise<Inventory | null> {
    for (const record of this.store.values()) {
      if (record.id === id) return { ...record };
    }
    return null;
  }

  async findBySku(sku: string): Promise<Inventory | null> {
    const record = this.store.get(sku.trim().toUpperCase());
    return record ? { ...record } : null;
  }

  async create(record: Inventory): Promise<void> {
    if (this.store.has(record.sku)) throw new Error('E11000 duplicate sku');
    this.store.set(record.sku, { ...record });
  }

  async list(options: InventoryListOptions): Promise<InventoryListResult> {
    let items = [...this.store.values()].sort((a, b) => a.sku.localeCompare(b.sku));
    if (options.sku) {
      items = items.filter((r) => r.sku === options.sku!.trim().toUpperCase());
    } else if (options.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(options.cursor, 'base64').toString('utf-8')) as {
          sku: string;
        };
        items = items.filter((r) => r.sku > decoded.sku);
      } catch {
        throw new Error('INVALID_CURSOR');
      }
    }
    const page = items.slice(0, options.limit);
    const hasMore = items.length > options.limit;
    const last = page[page.length - 1];
    if (options.status) {
      const { deriveStockStatus } = await import('@modules/inventory/domain/entities/Inventory');
      return {
        records: page.filter((r) => deriveStockStatus(r) === options.status).map((r) => ({ ...r })),
        nextCursor:
          hasMore && last
            ? Buffer.from(JSON.stringify({ sku: last.sku })).toString('base64')
            : null,
      };
    }
    return {
      records: page.map((r) => ({ ...r })),
      nextCursor:
        hasMore && last ? Buffer.from(JSON.stringify({ sku: last.sku })).toString('base64') : null,
    };
  }

  async applyAdjustment(skuOrId: string, delta: number): Promise<AdjustmentOutcome | null> {
    const record =
      this.store.get(skuOrId.trim().toUpperCase()) ??
      [...this.store.values()].find((r) => r.id === skuOrId);
    if (!record) return null;
    const newOnHand = record.onHand + delta;
    if (newOnHand < record.reserved || newOnHand < 0) return null;
    const updated: Inventory = {
      ...record,
      onHand: newOnHand,
      version: record.version + 1,
      updatedAt: new Date(),
      lastMovementAt: new Date(),
    };
    this.store.set(record.sku, updated);
    return {
      record: { ...updated },
      previousOnHand: record.onHand,
      previousReserved: record.reserved,
    };
  }

  async reserveStock(sku: string, quantity: number): Promise<Inventory | null> {
    const record = this.store.get(sku.trim().toUpperCase());
    if (!record || record.onHand - record.reserved < quantity) return null;
    const updated: Inventory = {
      ...record,
      reserved: record.reserved + quantity,
      version: record.version + 1,
      updatedAt: new Date(),
      lastMovementAt: new Date(),
    };
    this.store.set(record.sku, updated);
    return { ...updated };
  }

  async releaseStock(sku: string, quantity: number): Promise<Inventory | null> {
    const record = this.store.get(sku.trim().toUpperCase());
    if (!record || record.reserved < quantity) return null;
    const updated: Inventory = {
      ...record,
      reserved: record.reserved - quantity,
      version: record.version + 1,
      updatedAt: new Date(),
      lastMovementAt: new Date(),
    };
    this.store.set(record.sku, updated);
    return { ...updated };
  }

  async commitStock(sku: string, quantity: number): Promise<Inventory | null> {
    const record = this.store.get(sku.trim().toUpperCase());
    if (!record || record.reserved < quantity) return null;
    const updated: Inventory = {
      ...record,
      reserved: record.reserved - quantity,
      onHand: record.onHand - quantity,
      sold: record.sold + quantity,
      version: record.version + 1,
      updatedAt: new Date(),
      lastMovementAt: new Date(),
    };
    this.store.set(record.sku, updated);
    return { ...updated };
  }
}

export class FakeReservationRepository implements ReservationRepository {
  readonly store = new Map<string, Reservation>();

  async findById(id: string): Promise<Reservation | null> {
    const reservation = this.store.get(id);
    return reservation ? { ...reservation } : null;
  }

  async findByIdempotencyKey(key: string): Promise<Reservation | null> {
    for (const reservation of this.store.values()) {
      if (reservation.idempotencyKey === key) return { ...reservation };
    }
    return null;
  }

  async create(reservation: Reservation): Promise<void> {
    if (this.store.has(reservation.id)) throw new Error('E11000 duplicate _id');
    for (const existing of this.store.values()) {
      if (reservation.idempotencyKey && existing.idempotencyKey === reservation.idempotencyKey) {
        throw new Error('E11000 duplicate idemKey');
      }
    }
    this.store.set(reservation.id, { ...reservation });
  }

  async transition(
    id: string,
    from: ReservationStatus[],
    to: ReservationStatus,
  ): Promise<Reservation | null> {
    const reservation = this.store.get(id);
    if (!reservation || !from.includes(reservation.status)) return null;
    const updated: Reservation = {
      ...reservation,
      status: to,
      version: reservation.version + 1,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async findActiveExpired(now: Date, limit: number): Promise<Reservation[]> {
    return [...this.store.values()]
      .filter((r) => r.status === 'active' && r.expiresAt <= now)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }
}

export class FakeMovementRepository implements MovementRepository {
  readonly store: InventoryMovement[] = [];

  async append(movement: InventoryMovement): Promise<void> {
    if (
      movement.idempotencyKey &&
      this.store.some((m) => m.idempotencyKey === movement.idempotencyKey)
    ) {
      return;
    }
    this.store.push({ ...movement });
  }

  async findByIdempotencyKey(key: string): Promise<InventoryMovement | null> {
    const movement = this.store.find((m) => m.idempotencyKey === key);
    return movement ? { ...movement } : null;
  }

  async findByInventoryId(
    inventoryId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ movements: InventoryMovement[]; nextCursor: string | null }> {
    let items = this.store
      .filter((m) => m.inventoryId === inventoryId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as {
          createdAt: number;
          id: string;
        };
        items = items.filter(
          (m) =>
            m.createdAt.getTime() < decoded.createdAt ||
            (m.createdAt.getTime() === decoded.createdAt && m.id < decoded.id),
        );
      } catch {
        throw new Error('INVALID_CURSOR');
      }
    }
    const page = items.slice(0, limit);
    const hasMore = items.length > limit;
    const last = page[page.length - 1];
    return {
      movements: page.map((m) => ({ ...m })),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt.getTime(), id: last.id }),
            ).toString('base64')
          : null,
    };
  }
}

export class FakeInventoryCatalog implements InventoryCatalogPort {
  constructor(private readonly refs: Map<string, CatalogVariantRef>) {}

  async resolveSku(sku: string): Promise<CatalogVariantRef | null> {
    return this.refs.get(sku.trim().toUpperCase()) ?? null;
  }

  async resolveVariant(productId: string, variantId: string): Promise<CatalogVariantRef | null> {
    for (const ref of this.refs.values()) {
      if (ref.productId === productId && ref.variantId === variantId) return ref;
    }
    return null;
  }
}

export function catalogRef(overrides: Partial<CatalogVariantRef> = {}): CatalogVariantRef {
  return {
    productId: INV_PROD_ID,
    variantId: INV_VAR_ID,
    sku: 'SKU-001',
    active: true,
    ...overrides,
  };
}

export class FakeInventoryEventPublisher implements InventoryEventPublisher {
  readonly events: InventoryEventEnvelope[] = [];

  async publish(event: InventoryEventEnvelope): Promise<void> {
    this.events.push(event);
  }

  types(): string[] {
    return this.events.map((e) => e.eventType);
  }
}
