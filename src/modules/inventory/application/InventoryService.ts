import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';
import type { MetricsCollector } from '@infrastructure/observability/metrics';
import { DatabaseError } from '@shared/errors/app-error';
import { AppErrorFactory } from '@shared/errors/app-error-factory';

import {
  ADJUSTMENT_REASONS,
  availableQuantity,
  canTransitionReservation,
  deriveStockStatus,
  DEFAULT_LOW_STOCK_THRESHOLD,
  DEFAULT_RESERVATION_TTL_SECONDS,
  MAX_ADJUSTMENT_DELTA,
  MAX_RESERVATION_QUANTITY,
  MAX_RESERVATION_TTL_SECONDS,
  MIN_RESERVATION_TTL_SECONDS,
  normalizeSku,
  type AdjustmentReason,
  type Inventory,
  type Reservation,
  type StockStatus,
} from '../domain/entities/Inventory';
import {
  AdjustmentRejectedError,
  InsufficientStockError,
  InvalidQuantityError,
  InventoryNotFoundError,
  ReservationNotFoundError,
} from '../domain/errors/InventoryErrors';
import {
  buildInventoryEvent,
  type InventoryEventPublisher,
} from '../domain/events/InventoryEvents';
import type {
  InventoryCatalogPort,
  InventoryRepository,
  MovementRepository,
  ReservationRepository,
} from '../domain/repositories/InventoryRepository';

export interface InventoryActor {
  type: 'staff' | 'admin' | 'system';
  id: string;
}

export interface InventoryView {
  id: string;
  sku: string;
  productId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  sold: number;
  available: number;
  lowStockThreshold: number;
  status: StockStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastMovementAt: Date;
}

export interface AvailabilityView {
  sku: string;
  available: boolean;
  status: StockStatus;
}

export interface ReservationView {
  id: string;
  inventoryId: string;
  sku: string;
  quantity: number;
  status: Reservation['status'];
  referenceType: string;
  referenceId: string;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnsureInventoryInput {
  sku?: string;
  productId?: string;
  variantId?: string;
  initialOnHand?: number;
  lowStockThreshold?: number;
}

export interface AdjustInventoryInput {
  sku?: string;
  inventoryId?: string;
  delta: number;
  reason: AdjustmentReason;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
}

export interface ReserveInput {
  sku: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  ttlSeconds?: number;
}

const NULL_METRICS: MetricsCollector = {
  increment(): void {},
  gauge(): void {},
  timing(): void {},
  getMetrics() {
    return [];
  },
  reset(): void {},
};

function audit(
  logger: Logger,
  action: string,
  actor: InventoryActor,
  resourceId: string,
  correlationId?: string,
  extra: Record<string, unknown> = {},
): void {
  logger.info('Inventory audit', {
    actor: actor.id,
    actorType: actor.type,
    action,
    resource: 'inventory',
    resourceId,
    result: 'success',
    correlationId,
    ...extra,
  });
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

export class InventoryService {
  constructor(
    private readonly inventories: InventoryRepository,
    private readonly reservations: ReservationRepository,
    private readonly movements: MovementRepository,
    private readonly catalog: InventoryCatalogPort,
    private readonly events: InventoryEventPublisher,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector = NULL_METRICS,
  ) {}

  async ensureInventory(
    input: EnsureInventoryInput,
    actor: InventoryActor,
    correlationId?: string,
  ): Promise<{ view: InventoryView; created: boolean }> {
    const ref = input.sku
      ? await this.catalog.resolveSku(input.sku)
      : input.productId && input.variantId
        ? await this.catalog.resolveVariant(input.productId, input.variantId)
        : null;
    if (!ref) {
      throw new InventoryNotFoundError('Variant not found for inventory bootstrap', correlationId);
    }
    const existing = await this.inventories.findBySku(ref.sku);
    if (existing) return { view: this.toView(existing), created: false };

    const initialOnHand = input.initialOnHand ?? 0;
    if (!isIntegerInRange(initialOnHand, 0, MAX_ADJUSTMENT_DELTA)) {
      throw new InvalidQuantityError('initialOnHand must be an integer between 0 and 1000000');
    }
    const threshold = input.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    if (!isIntegerInRange(threshold, 0, MAX_ADJUSTMENT_DELTA)) {
      throw new InvalidQuantityError('lowStockThreshold must be an integer between 0 and 1000000');
    }
    const now = new Date();
    try {
      await this.inventories.create({
        id: randomUUID(),
        sku: normalizeSku(ref.sku),
        productId: ref.productId,
        variantId: ref.variantId,
        onHand: initialOnHand,
        reserved: 0,
        sold: 0,
        lowStockThreshold: threshold,
        version: 0,
        createdAt: now,
        updatedAt: now,
        lastMovementAt: now,
      });
    } catch (error) {
      if (/duplicate|E11000/i.test((error as Error).message)) {
        const raced = await this.inventories.findBySku(ref.sku);
        if (raced) return { view: this.toView(raced), created: false };
      }
      throw error;
    }
    const created = await this.inventories.findBySku(ref.sku);
    if (!created) throw new InventoryNotFoundError('Inventory creation failed', correlationId);
    await this.movements.append({
      id: randomUUID(),
      inventoryId: created.id,
      sku: created.sku,
      type: 'INIT',
      quantityDelta: initialOnHand,
      previousOnHand: 0,
      previousReserved: 0,
      newOnHand: created.onHand,
      newReserved: 0,
      reason: 'BOOTSTRAP',
      referenceType: 'variant',
      referenceId: ref.variantId,
      actorType: actor.type,
      actorId: actor.id,
      idempotencyKey: `init:${created.id}`,
      correlationId: correlationId ?? '',
      createdAt: now,
    });
    audit(this.logger, 'INVENTORY_CREATED', actor, created.id, correlationId, { sku: created.sku });
    return { view: this.toView(created), created: true };
  }

  async getRecord(skuOrId: string, correlationId?: string): Promise<InventoryView> {
    const record = await this.findRecord(skuOrId);
    if (!record) throw new InventoryNotFoundError('Inventory record not found', correlationId);
    this.logger.debug('inventory.read', { skuOrId, correlationId });
    return this.toView(record);
  }

  async listRecords(
    options: { sku?: string; status?: StockStatus; limit: number; cursor?: string },
    correlationId?: string,
  ): Promise<{
    records: InventoryView[];
    pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
  }> {
    let page;
    try {
      page = await this.inventories.list(options);
    } catch (error) {
      if ((error as Error).message === 'INVALID_CURSOR') {
        throw AppErrorFactory.validation('cursor', 'Invalid pagination cursor');
      }
      throw error;
    }
    this.logger.debug('inventory.list', { correlationId });
    return {
      records: page.records.map((r) => this.toView(r)),
      pagination: {
        limit: options.limit,
        nextCursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
      },
    };
  }

  async getAvailability(sku: string, correlationId?: string): Promise<AvailabilityView> {
    const record = await this.inventories.findBySku(sku);
    if (!record) throw new InventoryNotFoundError('Inventory record not found', correlationId);
    const status = deriveStockStatus(record);
    return { sku: record.sku, available: status !== 'OUT_OF_STOCK', status };
  }

  async adjust(
    input: AdjustInventoryInput,
    actor: InventoryActor,
    correlationId?: string,
  ): Promise<InventoryView> {
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new InvalidQuantityError('delta must be a non-zero integer');
    }
    if (Math.abs(input.delta) > MAX_ADJUSTMENT_DELTA) {
      throw new InvalidQuantityError('delta exceeds the maximum adjustment size');
    }
    if (!ADJUSTMENT_REASONS.includes(input.reason)) {
      throw new InvalidQuantityError('Unsupported adjustment reason');
    }
    const locator = input.inventoryId ?? input.sku;
    if (!locator) throw new InvalidQuantityError('Either sku or inventoryId is required');
    const before = await this.findRecord(locator);
    if (!before) throw new InventoryNotFoundError('Inventory record not found', correlationId);

    if (input.idempotencyKey) {
      const prior = await this.movements.findByIdempotencyKey(input.idempotencyKey);
      if (prior) {
        const current = await this.findRecord(locator);
        if (!current) throw new InventoryNotFoundError();
        this.logger.info('inventory.adjust_replayed', {
          sku: current.sku,
          correlationId,
        });
        return this.toView(current);
      }
    }

    const outcome = await this.inventories.applyAdjustment(before.sku, input.delta);
    if (!outcome) {
      this.metrics.increment('inventory_adjustment_rejected_total');
      throw new AdjustmentRejectedError(
        'Adjustment would violate stock invariants (onHand must stay >= reserved and >= 0)',
        correlationId,
      );
    }
    const movementId = randomUUID();
    await this.movements.append({
      id: movementId,
      inventoryId: outcome.record.id,
      sku: outcome.record.sku,
      type: 'ADJUST',
      quantityDelta: input.delta,
      previousOnHand: outcome.previousOnHand,
      previousReserved: outcome.previousReserved,
      newOnHand: outcome.record.onHand,
      newReserved: outcome.record.reserved,
      reason: input.reason,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      actorType: actor.type,
      actorId: actor.id,
      idempotencyKey: input.idempotencyKey ?? `adjust:${movementId}`,
      correlationId: correlationId ?? '',
      createdAt: new Date(),
    });

    const beforeStatus = deriveStockStatus({
      ...before,
      onHand: outcome.previousOnHand,
      reserved: outcome.previousReserved,
    });
    const afterStatus = deriveStockStatus(outcome.record);
    await this.emit(
      'inventory.adjusted',
      'inventory',
      outcome.record.sku,
      {
        sku: outcome.record.sku,
        delta: input.delta,
        reason: input.reason,
        previousOnHand: outcome.previousOnHand,
        newOnHand: outcome.record.onHand,
        newAvailable: availableQuantity(outcome.record),
        status: afterStatus,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
      },
      correlationId,
    );
    if (
      beforeStatus !== 'LOW_STOCK' &&
      beforeStatus !== 'OUT_OF_STOCK' &&
      afterStatus === 'LOW_STOCK'
    ) {
      this.metrics.increment('inventory_low_stock_total');
      await this.emit(
        'inventory.lowStock',
        'inventory',
        outcome.record.sku,
        {
          sku: outcome.record.sku,
          available: availableQuantity(outcome.record),
          threshold: outcome.record.lowStockThreshold,
        },
        correlationId,
      );
    }
    this.metrics.increment('inventory_adjustment_total');
    audit(this.logger, 'INVENTORY_ADJUSTED', actor, outcome.record.id, correlationId, {
      sku: outcome.record.sku,
      delta: input.delta,
      reason: input.reason,
      before: outcome.previousOnHand,
      after: outcome.record.onHand,
    });
    return this.toView(outcome.record);
  }

  async reserve(
    input: ReserveInput,
    actor: InventoryActor,
    correlationId?: string,
  ): Promise<{ reservation: ReservationView; inventory: InventoryView; replayed: boolean }> {
    if (!isIntegerInRange(input.quantity, 1, MAX_RESERVATION_QUANTITY)) {
      throw new InvalidQuantityError('quantity must be an integer between 1 and 1000');
    }
    if (!input.referenceType.trim() || !input.referenceId.trim()) {
      throw new InvalidQuantityError('referenceType and referenceId are required');
    }
    const sku = normalizeSku(input.sku);
    const record = await this.inventories.findBySku(sku);
    if (!record) throw new InventoryNotFoundError('Inventory record not found', correlationId);

    const fingerprint = {
      sku,
      quantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    };
    const prior = await this.reservations.findByIdempotencyKey(input.idempotencyKey);
    if (prior) {
      if (
        prior.sku !== fingerprint.sku ||
        prior.quantity !== fingerprint.quantity ||
        prior.referenceType !== fingerprint.referenceType ||
        prior.referenceId !== fingerprint.referenceId
      ) {
        throw AppErrorFactory.idempotencyConflict(correlationId);
      }
      const current = await this.inventories.findBySku(sku);
      this.logger.info('inventory.reserve_replayed', { reservationId: prior.id, correlationId });
      return {
        reservation: this.toReservationView(prior),
        inventory: this.toView(current ?? record),
        replayed: true,
      };
    }

    const afterReserve = await this.inventories.reserveStock(sku, input.quantity);
    if (!afterReserve) {
      this.metrics.increment('inventory_insufficient_stock_total');
      this.logger.warn('inventory.insufficient_stock', {
        sku,
        quantity: input.quantity,
        correlationId,
      });
      throw new InsufficientStockError(
        `Insufficient stock for SKU ${sku}: requested ${input.quantity}`,
        correlationId,
      );
    }

    const ttlSeconds = Math.min(
      Math.max(input.ttlSeconds ?? DEFAULT_RESERVATION_TTL_SECONDS, MIN_RESERVATION_TTL_SECONDS),
      MAX_RESERVATION_TTL_SECONDS,
    );
    const now = new Date();
    const reservation: Reservation = {
      id: randomUUID(),
      inventoryId: record.id,
      sku,
      productId: record.productId,
      variantId: record.variantId,
      quantity: input.quantity,
      status: 'active',
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.reservations.create(reservation);
    } catch (error) {
      if (/duplicate|E11000/i.test((error as Error).message)) {
        await this.inventories.releaseStock(sku, input.quantity);
        const winner = await this.reservations.findByIdempotencyKey(input.idempotencyKey);
        if (!winner) throw error;
        if (
          winner.sku !== fingerprint.sku ||
          winner.quantity !== fingerprint.quantity ||
          winner.referenceType !== fingerprint.referenceType ||
          winner.referenceId !== fingerprint.referenceId
        ) {
          throw AppErrorFactory.idempotencyConflict(correlationId);
        }
        const current = await this.inventories.findBySku(sku);
        return {
          reservation: this.toReservationView(winner),
          inventory: this.toView(current ?? afterReserve),
          replayed: true,
        };
      }
      await this.inventories.releaseStock(sku, input.quantity);
      throw error;
    }

    await this.movements.append({
      id: randomUUID(),
      inventoryId: record.id,
      sku,
      type: 'RESERVE',
      quantityDelta: input.quantity,
      previousOnHand: afterReserve.onHand,
      previousReserved: afterReserve.reserved - input.quantity,
      newOnHand: afterReserve.onHand,
      newReserved: afterReserve.reserved,
      reason: 'RESERVE',
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      actorType: actor.type,
      actorId: actor.id,
      idempotencyKey: `${reservation.id}:reserve`,
      correlationId: correlationId ?? '',
      createdAt: now,
    });
    await this.emit(
      'inventory.reserved',
      'reservation',
      reservation.id,
      {
        reservationId: reservation.id,
        sku,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        expiresAt: reservation.expiresAt.toISOString(),
        available: availableQuantity(afterReserve),
      },
      correlationId,
      reservation.id,
    );
    this.metrics.increment('inventory_reservation_success_total');
    audit(this.logger, 'INVENTORY_RESERVED', actor, reservation.id, correlationId, {
      sku,
      quantity: input.quantity,
    });
    return {
      reservation: this.toReservationView(reservation),
      inventory: this.toView(afterReserve),
      replayed: false,
    };
  }

  async release(
    id: string,
    actor: InventoryActor,
    options: { asExpired?: boolean; reason?: string } = {},
    correlationId?: string,
  ): Promise<{ reservation: ReservationView; inventory: InventoryView; replayed: boolean }> {
    const existing = await this.reservations.findById(id);
    if (!existing) throw new ReservationNotFoundError('Reservation not found', correlationId);
    const target = options.asExpired ? 'expired' : 'released';
    if (existing.status !== 'active') {
      const record = await this.inventories.findBySku(existing.sku);
      return {
        reservation: this.toReservationView(existing),
        inventory: record ? this.toView(record) : this.emptyView(existing),
        replayed: true,
      };
    }
    if (!canTransitionReservation('active', target)) {
      throw new ReservationNotFoundError('Reservation not found', correlationId);
    }
    const transitioned = await this.reservations.transition(id, ['active'], target);
    if (!transitioned) {
      const current = await this.reservations.findById(id);
      if (!current) throw new ReservationNotFoundError();
      const record = await this.inventories.findBySku(current.sku);
      return {
        reservation: this.toReservationView(current),
        inventory: record ? this.toView(record) : this.emptyView(current),
        replayed: true,
      };
    }
    const afterRelease = await this.inventories.releaseStock(existing.sku, existing.quantity);
    if (!afterRelease) {
      this.logger.error('inventory.release_stock_failed', {
        reservationId: id,
        sku: existing.sku,
        correlationId,
      });
      throw new DatabaseError('Inventory release failed after state transition', correlationId);
    }
    const movementType = options.asExpired ? 'EXPIRE' : 'RELEASE';
    await this.movements.append({
      id: randomUUID(),
      inventoryId: existing.inventoryId,
      sku: existing.sku,
      type: movementType,
      quantityDelta: -existing.quantity,
      previousOnHand: afterRelease.onHand,
      previousReserved: afterRelease.reserved + existing.quantity,
      newOnHand: afterRelease.onHand,
      newReserved: afterRelease.reserved,
      reason: options.reason ?? (options.asExpired ? 'EXPIRED' : 'RELEASED'),
      referenceType: existing.referenceType,
      referenceId: existing.referenceId,
      actorType: actor.type,
      actorId: actor.id,
      idempotencyKey: `${existing.id}:${movementType.toLowerCase()}`,
      correlationId: correlationId ?? '',
      createdAt: new Date(),
    });
    await this.emit(
      'inventory.released',
      'reservation',
      existing.id,
      {
        reservationId: existing.id,
        sku: existing.sku,
        quantity: existing.quantity,
        reason: options.reason ?? (options.asExpired ? 'expired' : 'released'),
        status: target,
        available: availableQuantity(afterRelease),
      },
      correlationId,
      existing.id,
    );
    this.metrics.increment(
      options.asExpired ? 'inventory_expiration_total' : 'inventory_release_total',
    );
    audit(
      this.logger,
      options.asExpired ? 'INVENTORY_RESERVATION_EXPIRED' : 'INVENTORY_RELEASED',
      actor,
      id,
      correlationId,
      {
        sku: existing.sku,
        quantity: existing.quantity,
      },
    );
    return {
      reservation: this.toReservationView(transitioned),
      inventory: this.toView(afterRelease),
      replayed: false,
    };
  }

  async confirm(
    id: string,
    actor: InventoryActor,
    correlationId?: string,
  ): Promise<{ reservation: ReservationView; inventory: InventoryView; replayed: boolean }> {
    const existing = await this.reservations.findById(id);
    if (!existing) throw new ReservationNotFoundError('Reservation not found', correlationId);
    if (existing.status !== 'active') {
      if (existing.status === 'confirmed') {
        const record = await this.inventories.findBySku(existing.sku);
        return {
          reservation: this.toReservationView(existing),
          inventory: record ? this.toView(record) : this.emptyView(existing),
          replayed: true,
        };
      }
      throw new ReservationNotFoundError(
        `Reservation is ${existing.status} and cannot be confirmed`,
        correlationId,
      );
    }
    const transitioned = await this.reservations.transition(id, ['active'], 'confirmed');
    if (!transitioned) {
      const current = await this.reservations.findById(id);
      if (!current) throw new ReservationNotFoundError();
      if (current.status === 'confirmed') {
        const record = await this.inventories.findBySku(current.sku);
        return {
          reservation: this.toReservationView(current),
          inventory: record ? this.toView(record) : this.emptyView(current),
          replayed: true,
        };
      }
      throw new ReservationNotFoundError('Reservation cannot be confirmed', correlationId);
    }
    const afterCommit = await this.inventories.commitStock(existing.sku, existing.quantity);
    if (!afterCommit) {
      this.logger.error('inventory.commit_stock_failed', {
        reservationId: id,
        sku: existing.sku,
        correlationId,
      });
      throw new DatabaseError('Inventory commit failed after state transition', correlationId);
    }
    await this.movements.append({
      id: randomUUID(),
      inventoryId: existing.inventoryId,
      sku: existing.sku,
      type: 'CONFIRM',
      quantityDelta: -existing.quantity,
      previousOnHand: afterCommit.onHand + existing.quantity,
      previousReserved: afterCommit.reserved + existing.quantity,
      newOnHand: afterCommit.onHand,
      newReserved: afterCommit.reserved,
      reason: 'CONFIRMED',
      referenceType: existing.referenceType,
      referenceId: existing.referenceId,
      actorType: actor.type,
      actorId: actor.id,
      idempotencyKey: `${existing.id}:confirm`,
      correlationId: correlationId ?? '',
      createdAt: new Date(),
    });
    await this.emit(
      'inventory.committed',
      'reservation',
      existing.id,
      {
        reservationId: existing.id,
        sku: existing.sku,
        quantity: existing.quantity,
        referenceType: existing.referenceType,
        referenceId: existing.referenceId,
        available: availableQuantity(afterCommit),
      },
      correlationId,
      existing.id,
    );
    this.metrics.increment('inventory_confirm_total');
    audit(this.logger, 'INVENTORY_CONFIRMED', actor, id, correlationId, {
      sku: existing.sku,
      quantity: existing.quantity,
    });
    return {
      reservation: this.toReservationView(transitioned),
      inventory: this.toView(afterCommit),
      replayed: false,
    };
  }

  async expireReservations(
    options: { limit?: number; now?: Date } = {},
    actor: InventoryActor,
    correlationId?: string,
  ): Promise<{ scanned: number; expired: number; failed: number }> {
    const now = options.now ?? new Date();
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const due = await this.reservations.findActiveExpired(now, limit);
    let expired = 0;
    let failed = 0;
    for (const reservation of due) {
      try {
        await this.release(reservation.id, actor, { asExpired: true }, correlationId);
        expired += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn('inventory.expire_failed', {
          reservationId: reservation.id,
          error: (error as Error).message,
          correlationId,
        });
      }
    }
    this.logger.info('inventory.expire_sweep', {
      scanned: due.length,
      expired,
      failed,
      correlationId,
    });
    return { scanned: due.length, expired, failed };
  }

  async getReservation(id: string, correlationId?: string): Promise<ReservationView> {
    const reservation = await this.reservations.findById(id);
    if (!reservation) throw new ReservationNotFoundError('Reservation not found', correlationId);
    return this.toReservationView(reservation);
  }

  async listMovements(
    skuOrId: string,
    options: { limit: number; cursor?: string },
    correlationId?: string,
  ): Promise<{
    movements: MovementView[];
    pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
  }> {
    const record = await this.findRecord(skuOrId);
    if (!record) throw new InventoryNotFoundError('Inventory record not found', correlationId);
    let page;
    try {
      page = await this.movements.findByInventoryId(record.id, options.limit, options.cursor);
    } catch (error) {
      if ((error as Error).message === 'INVALID_CURSOR') {
        throw AppErrorFactory.validation('cursor', 'Invalid pagination cursor');
      }
      throw error;
    }
    return {
      movements: page.movements.map((m) => ({ ...m })),
      pagination: {
        limit: options.limit,
        nextCursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
      },
    };
  }

  private async findRecord(skuOrId: string): Promise<Inventory | null> {
    const bySku = await this.inventories.findBySku(skuOrId);
    if (bySku) return bySku;
    if (/^[0-9a-f-]{8,}/i.test(skuOrId)) {
      return this.inventories.findById(skuOrId);
    }
    return null;
  }

  private toView(record: Inventory): InventoryView {
    return {
      id: record.id,
      sku: record.sku,
      productId: record.productId,
      variantId: record.variantId,
      onHand: record.onHand,
      reserved: record.reserved,
      sold: record.sold,
      available: availableQuantity(record),
      lowStockThreshold: record.lowStockThreshold,
      status: deriveStockStatus(record),
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastMovementAt: record.lastMovementAt,
    };
  }

  private toReservationView(reservation: Reservation): ReservationView {
    return {
      id: reservation.id,
      inventoryId: reservation.inventoryId,
      sku: reservation.sku,
      quantity: reservation.quantity,
      status: reservation.status,
      referenceType: reservation.referenceType,
      referenceId: reservation.referenceId,
      expiresAt: reservation.expiresAt,
      version: reservation.version,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  }

  private emptyView(reservation: Reservation): InventoryView {
    const now = new Date();
    return {
      id: reservation.inventoryId,
      sku: reservation.sku,
      productId: reservation.productId,
      variantId: reservation.variantId,
      onHand: 0,
      reserved: 0,
      sold: 0,
      available: 0,
      lowStockThreshold: 0,
      status: 'OUT_OF_STOCK',
      version: 0,
      createdAt: now,
      updatedAt: now,
      lastMovementAt: now,
    };
  }

  private async emit(
    eventType: Parameters<typeof buildInventoryEvent>[0],
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    correlationId?: string,
    causationId?: string | null,
  ): Promise<void> {
    try {
      await this.events.publish(
        buildInventoryEvent(eventType, aggregateType, aggregateId, payload, {
          correlationId,
          causationId: causationId ?? null,
        }),
      );
    } catch (error) {
      this.logger.warn('Inventory event publish failed (non-blocking)', {
        error: (error as Error).message,
        eventType,
      });
    }
  }
}

export interface MovementView {
  id: string;
  inventoryId: string;
  sku: string;
  type: string;
  quantityDelta: number;
  previousOnHand: number;
  previousReserved: number;
  newOnHand: number;
  newReserved: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string;
  actorId: string;
  correlationId: string;
  createdAt: Date;
}
