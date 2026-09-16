import { randomUUID } from 'crypto';

import { describe, it, expect } from 'vitest';

import {
  InventoryService,
  type InventoryActor,
} from '../../../src/modules/inventory/application/InventoryService';
import { VariantBootstrapHandler } from '../../../src/modules/inventory/application/VariantBootstrapHandler';
import { testLogger } from '../../helpers/fakes';
import {
  FakeInventoryCatalog,
  FakeInventoryEventPublisher,
  FakeInventoryRepository,
  FakeMovementRepository,
  FakeReservationRepository,
  catalogRef,
  makeInventory,
} from '../../helpers/inventory-fakes';

const actor: InventoryActor = { type: 'admin', id: 'admin-1' };

function setup(onHand = 100) {
  const inventories = new FakeInventoryRepository();
  const reservations = new FakeReservationRepository();
  const movements = new FakeMovementRepository();
  const catalog = new FakeInventoryCatalog(new Map([['SKU-001', catalogRef()]]));
  const events = new FakeInventoryEventPublisher();
  const service = new InventoryService(
    inventories,
    reservations,
    movements,
    catalog,
    events,
    testLogger,
  );
  inventories.store.set('SKU-001', makeInventory({ onHand }));
  return { inventories, reservations, movements, catalog, events, service };
}

describe('InventoryService adjustments', () => {
  it('applies receipt and damage within invariants, rejects the rest', async () => {
    const { service } = setup(100);
    const afterReceipt = await service.adjust(
      { sku: 'SKU-001', delta: 50, reason: 'RECEIPT' },
      actor,
    );
    expect(afterReceipt.onHand).toBe(150);
    expect(afterReceipt.available).toBe(150);

    const afterDamage = await service.adjust(
      { sku: 'SKU-001', delta: -20, reason: 'DAMAGE' },
      actor,
    );
    expect(afterDamage.onHand).toBe(130);

    await expect(
      service.adjust({ sku: 'SKU-001', delta: -1000, reason: 'LOSS' }, actor),
    ).rejects.toMatchObject({ code: 'UNPROCESSABLE' });
    await expect(
      service.adjust({ sku: 'SKU-001', delta: 0, reason: 'RECEIPT' }, actor),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      service.adjust({ sku: 'NOPE', delta: 5, reason: 'RECEIPT' }, actor),
    ).rejects.toMatchObject({ code: 'INVENTORY_NOT_FOUND' });
  });

  it('never lets adjustments breach reserved stock', async () => {
    const { service } = setup(10);
    await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 8,
        referenceType: 'checkout',
        referenceId: 'co-1',
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    await expect(
      service.adjust({ sku: 'SKU-001', delta: -5, reason: 'DAMAGE' }, actor),
    ).rejects.toMatchObject({ code: 'UNPROCESSABLE' });
    const view = await service.adjust({ sku: 'SKU-001', delta: -2, reason: 'DAMAGE' }, actor);
    expect(view.onHand).toBe(8);
    expect(view.available).toBe(0);
  });

  it('replays adjustments with the same idempotency key', async () => {
    const { service, movements } = setup(100);
    const key = randomUUID();
    await service.adjust(
      { sku: 'SKU-001', delta: 10, reason: 'RECEIPT', idempotencyKey: key },
      actor,
    );
    const replayed = await service.adjust(
      { sku: 'SKU-001', delta: 10, reason: 'RECEIPT', idempotencyKey: key },
      actor,
    );
    expect(replayed.onHand).toBe(110);
    expect(movements.store).toHaveLength(1);
  });

  it('emits lowStock once when crossing the threshold', async () => {
    const { service, events } = setup(10);
    await service.adjust({ sku: 'SKU-001', delta: -6, reason: 'DAMAGE' }, actor);
    const lowEvents = events.events.filter((e) => e.eventType === 'inventory.lowStock');
    expect(lowEvents).toHaveLength(1);
    expect(lowEvents[0]!.payload.sku).toBe('SKU-001');
    await service.adjust({ sku: 'SKU-001', delta: -1, reason: 'DAMAGE' }, actor);
    expect(events.events.filter((e) => e.eventType === 'inventory.lowStock')).toHaveLength(1);
  });
});

describe('InventoryService reservations', () => {
  it('reserves, releases, and confirms with ledger entries', async () => {
    const { service, movements, events } = setup(10);
    const { reservation, inventory } = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 4,
        referenceType: 'checkout',
        referenceId: 'co-1',
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    expect(reservation.status).toBe('active');
    expect(inventory.reserved).toBe(4);
    expect(inventory.available).toBe(6);

    const released = await service.release(reservation.id, actor);
    expect(released.reservation.status).toBe('released');
    expect(released.inventory.reserved).toBe(0);

    const second = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 4,
        referenceType: 'checkout',
        referenceId: 'co-2',
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    const confirmed = await service.confirm(second.reservation.id, actor);
    expect(confirmed.reservation.status).toBe('confirmed');
    expect(confirmed.inventory.reserved).toBe(0);
    expect(confirmed.inventory.onHand).toBe(6);
    expect(confirmed.inventory.sold).toBe(4);

    expect(movements.store.map((m) => m.type)).toEqual([
      'RESERVE',
      'RELEASE',
      'RESERVE',
      'CONFIRM',
    ]);
    expect(events.types()).toContain('inventory.reserved');
    expect(events.types()).toContain('inventory.released');
    expect(events.types()).toContain('inventory.committed');
  });

  it('rejects over-reservation with 409 and never goes negative', async () => {
    const { service, inventories } = setup(5);
    await expect(
      service.reserve(
        {
          sku: 'SKU-001',
          quantity: 6,
          referenceType: 'checkout',
          referenceId: 'co-1',
          idempotencyKey: randomUUID(),
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    const record = await inventories.findBySku('SKU-001');
    expect(record!.reserved).toBe(0);
    expect(record!.onHand).toBe(5);
  });

  it('replays same key + same payload, rejects same key + different payload', async () => {
    const { service, inventories } = setup(10);
    const key = randomUUID();
    const first = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 2,
        referenceType: 'checkout',
        referenceId: 'co-1',
        idempotencyKey: key,
      },
      actor,
    );
    const replay = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 2,
        referenceType: 'checkout',
        referenceId: 'co-1',
        idempotencyKey: key,
      },
      actor,
    );
    expect(replay.replayed).toBe(true);
    expect(replay.reservation.id).toBe(first.reservation.id);
    expect((await inventories.findBySku('SKU-001'))!.reserved).toBe(2);

    await expect(
      service.reserve(
        {
          sku: 'SKU-001',
          quantity: 3,
          referenceType: 'checkout',
          referenceId: 'co-1',
          idempotencyKey: key,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('makes release and confirm idempotent (no double stock movement)', async () => {
    const { service, inventories } = setup(10);
    const { reservation } = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 3,
        referenceType: 'checkout',
        referenceId: 'co-1',
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    await service.release(reservation.id, actor);
    const r2 = await service.release(reservation.id, actor);
    expect(r2.replayed).toBe(true);
    expect((await inventories.findBySku('SKU-001'))!.reserved).toBe(0);

    const second = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 3,
        referenceType: 'checkout',
        referenceId: 'co-2',
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    await service.confirm(second.reservation.id, actor);
    const confirmReplay = await service.confirm(second.reservation.id, actor);
    expect(confirmReplay.replayed).toBe(true);
    const record = (await inventories.findBySku('SKU-001'))!;
    expect(record.sold).toBe(3);
    expect(record.onHand).toBe(7);
  });

  it('refuses to confirm released or expired reservations', async () => {
    const { service } = setup(10);
    const { reservation } = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 2,
        referenceType: 'checkout',
        referenceId: 'co-1',
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    await service.release(reservation.id, actor);
    await expect(service.confirm(reservation.id, actor)).rejects.toMatchObject({
      code: 'RESERVATION_NOT_FOUND',
    });
  });

  it('expires due reservations and returns stock', async () => {
    const { service, inventories } = setup(10);
    const past = new Date(Date.now() - 1000);
    const { reservation } = await service.reserve(
      {
        sku: 'SKU-001',
        quantity: 4,
        referenceType: 'checkout',
        referenceId: 'co-1',
        idempotencyKey: randomUUID(),
        ttlSeconds: 60,
      },
      actor,
    );
    const stored = await inventories.findBySku('SKU-001');
    expect(stored!.reserved).toBe(4);

    const summary = await service.expireReservations(
      { limit: 100, now: new Date(Date.now() + 61 * 1000) },
      { type: 'system', id: 'sweeper' },
    );
    expect(summary).toMatchObject({ scanned: 1, expired: 1, failed: 0 });
    const after = await service.getReservation(reservation.id);
    expect(after.status).toBe('expired');
    expect((await inventories.findBySku('SKU-001'))!.reserved).toBe(0);
    void past;
  });
});

describe('VariantBootstrapHandler', () => {
  it('creates zero-stock inventory on variantCreated, ignores duplicates and updates', async () => {
    const inventories = new FakeInventoryRepository();
    const movements = new FakeMovementRepository();
    const catalog = new FakeInventoryCatalog(new Map([['SKU-001', catalogRef()]]));
    const handler = new VariantBootstrapHandler(inventories, movements, catalog, testLogger);

    const first = await handler.handle({
      eventId: 'evt-1',
      eventType: 'catalog.variantCreated',
      productId: catalogRef().productId,
      variantId: catalogRef().variantId,
      sku: 'SKU-001',
    });
    expect(first.bootstrapped).toBe(true);
    expect((await inventories.findBySku('SKU-001'))!.onHand).toBe(0);

    const second = await handler.handle({
      eventId: 'evt-2',
      eventType: 'catalog.variantCreated',
      productId: catalogRef().productId,
      variantId: catalogRef().variantId,
      sku: 'SKU-001',
    });
    expect(second.bootstrapped).toBe(false);

    const updated = await handler.handle({
      eventId: 'evt-3',
      eventType: 'catalog.variantUpdated',
      productId: catalogRef().productId,
      variantId: catalogRef().variantId,
      sku: 'SKU-001',
    });
    expect(updated.bootstrapped).toBe(false);
  });
});
