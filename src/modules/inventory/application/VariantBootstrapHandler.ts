import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';

import { DEFAULT_LOW_STOCK_THRESHOLD } from '../domain/entities/Inventory';
import type {
  InventoryCatalogPort,
  InventoryRepository,
  MovementRepository,
} from '../domain/repositories/InventoryRepository';

export interface CatalogVariantEvent {
  eventId: string;
  eventType: 'catalog.variantCreated' | 'catalog.variantUpdated';
  productId: string;
  variantId: string;
  sku: string;
  correlationId?: string;
}

export class VariantBootstrapHandler {
  constructor(
    private readonly inventories: InventoryRepository,
    private readonly movements: MovementRepository,
    private readonly catalog: InventoryCatalogPort,
    private readonly logger: Logger,
  ) {}

  async handle(event: CatalogVariantEvent): Promise<{ bootstrapped: boolean; sku: string }> {
    const ref = await this.catalog.resolveSku(event.sku);
    if (!ref) {
      this.logger.warn('inventory.bootstrap_skipped', {
        sku: event.sku,
        reason: 'variant_not_found',
        correlationId: event.correlationId,
      });
      return { bootstrapped: false, sku: event.sku };
    }
    const existing = await this.inventories.findBySku(ref.sku);
    if (existing) return { bootstrapped: false, sku: ref.sku };
    if (event.eventType === 'catalog.variantUpdated') return { bootstrapped: false, sku: ref.sku };

    const now = new Date();
    try {
      await this.inventories.create({
        id: randomUUID(),
        sku: ref.sku,
        productId: ref.productId,
        variantId: ref.variantId,
        onHand: 0,
        reserved: 0,
        sold: 0,
        lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
        version: 0,
        createdAt: now,
        updatedAt: now,
        lastMovementAt: now,
      });
    } catch (error) {
      if (/duplicate|E11000/i.test((error as Error).message)) {
        return { bootstrapped: false, sku: ref.sku };
      }
      throw error;
    }
    const created = await this.inventories.findBySku(ref.sku);
    if (created) {
      await this.movements.append({
        id: randomUUID(),
        inventoryId: created.id,
        sku: created.sku,
        type: 'INIT',
        quantityDelta: 0,
        previousOnHand: 0,
        previousReserved: 0,
        newOnHand: 0,
        newReserved: 0,
        reason: 'BOOTSTRAP',
        referenceType: 'variant',
        referenceId: ref.variantId,
        actorType: 'system',
        actorId: 'inventory-bootstrap',
        idempotencyKey: `bootstrap:${event.eventId}`,
        correlationId: event.correlationId ?? '',
        createdAt: now,
      });
    }
    this.logger.info('inventory.bootstrapped', {
      sku: ref.sku,
      variantId: ref.variantId,
      correlationId: event.correlationId,
    });
    return { bootstrapped: true, sku: ref.sku };
  }
}
