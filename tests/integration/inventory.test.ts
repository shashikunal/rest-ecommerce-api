import { randomUUID } from 'crypto';

import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { createApp } from '../../src/app/app';
import { envSchema } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';
import type { AuthRequest } from '../../src/modules/auth/middleware/auth.middleware';
import { InventoryService } from '../../src/modules/inventory/application/InventoryService';
import { createInventoryRoutes } from '../../src/modules/inventory/presentation/routes/inventory.routes';
import { testLogger } from '../helpers/fakes';
import {
  FakeInventoryCatalog,
  FakeInventoryEventPublisher,
  FakeInventoryRepository,
  FakeMovementRepository,
  FakeReservationRepository,
  catalogRef,
  makeInventory,
} from '../helpers/inventory-fakes';

const config = envSchema.parse({
  MONGODB_URI: 'mongodb://localhost:27017/test',
  REDIS_URL: 'redis://localhost:6379',
  KAFKA_BROKERS: 'localhost:9092',
  KAFKA_CLIENT_ID: 'test',
  KAFKA_GROUP_ID: 'test-group',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CORS_ORIGINS: 'http://localhost:3000',
  FEATURE_SWAGGER_UI: false,
});
const logger = createLogger(config);

function stubAuth(mode: 'admin' | 'customer' | 'none' = 'admin') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = (req.headers['x-test-role'] as string | undefined) ?? mode;
    if (role === 'none') {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access token required' },
      });
      return;
    }
    req.user = {
      id: 'actor-1',
      email: 'actor-1@example.com',
      roles: role === 'admin' ? ['admin'] : role === 'system' ? ['system'] : ['user'],
      sessionId: 'sess-1',
      correlationId: req.correlationId ?? '',
    };
    next();
  };
}

describe('Inventory API', () => {
  let inventories!: FakeInventoryRepository;
  let reservations!: FakeReservationRepository;
  let movements!: FakeMovementRepository;
  let events!: FakeInventoryEventPublisher;
  let service!: InventoryService;

  function app(mode: 'admin' | 'customer' | 'none' = 'admin') {
    const catalog = new FakeInventoryCatalog(new Map([['SKU-001', catalogRef()]]));
    service = new InventoryService(
      inventories,
      reservations,
      movements,
      catalog,
      events,
      testLogger,
    );
    return createApp({
      config,
      logger,
      inventoryRoutes: createInventoryRoutes({
        inventoryService: service,
        authMiddleware: stubAuth(mode),
        logger,
      }),
    });
  }

  beforeEach(() => {
    inventories = new FakeInventoryRepository();
    reservations = new FakeReservationRepository();
    movements = new FakeMovementRepository();
    events = new FakeInventoryEventPublisher();
    inventories.store.set('SKU-001', makeInventory({ onHand: 100 }));
  });

  it('serves public availability without auth and hides internals', async () => {
    const agent = request(app());
    const res = await agent.get('/api/v1/inventory/availability?sku=SKU-001');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ sku: 'SKU-001', available: true, status: 'IN_STOCK' });
    expect(res.body.data).not.toHaveProperty('onHand');
    expect(res.body.data).not.toHaveProperty('reserved');
    expect((await agent.get('/api/v1/inventory/availability?sku=NOPE')).status).toBe(404);
    expect((await agent.get('/api/v1/inventory/availability')).status).toBe(400);
  });

  it('runs admin lifecycle: init -> adjust -> movements -> reserve -> release -> confirm', async () => {
    const agent = request(app());
    const list = await agent.get('/api/v1/inventory?limit=20');
    expect(list.status).toBe(200);
    expect(list.body.data.records).toHaveLength(1);

    const init = await agent.post('/api/v1/inventory').send({ sku: 'SKU-001' });
    expect(init.status).toBe(200);

    const adjusted = await agent
      .post('/api/v1/inventory/adjust')
      .send({ sku: 'SKU-001', delta: 25, reason: 'RECEIPT' });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.data.onHand).toBe(125);

    const recordId = adjusted.body.data.id as string;
    const detail = await agent.get(`/api/v1/inventory/${recordId}`);
    expect(detail.body.data.available).toBe(125);

    const ledger = await agent.get(`/api/v1/inventory/${recordId}/movements?limit=20`);
    expect(ledger.status).toBe(200);
    expect(ledger.body.data.movements).toHaveLength(1);
    expect(ledger.body.data.movements[0]).toMatchObject({ type: 'ADJUST', quantityDelta: 25 });

    const reserved = await agent.post('/api/v1/inventory/reservations').send({
      sku: 'SKU-001',
      quantity: 10,
      referenceType: 'checkout',
      referenceId: 'co-1',
      idempotencyKey: randomUUID(),
    });
    expect(reserved.status).toBe(201);
    const reservationId = reserved.body.data.reservation.id as string;

    const fetched = await agent.get(`/api/v1/inventory/reservations/${reservationId}`);
    expect(fetched.body.data.status).toBe('active');

    const released = await agent
      .post(`/api/v1/inventory/reservations/${reservationId}/release`)
      .send({});
    expect(released.body.data.reservation.status).toBe('released');
    expect(released.body.data.inventory.reserved).toBe(0);

    const second = await agent.post('/api/v1/inventory/reservations').send({
      sku: 'SKU-001',
      quantity: 10,
      referenceType: 'checkout',
      referenceId: 'co-2',
      idempotencyKey: randomUUID(),
    });
    const confirmed = await agent
      .post(`/api/v1/inventory/reservations/${second.body.data.reservation.id}/confirm`)
      .send({});
    expect(confirmed.body.data.reservation.status).toBe('confirmed');
    expect(confirmed.body.data.inventory.sold).toBe(10);
  });

  it('replays reservation retries on the same idempotency key', async () => {
    const agent = request(app());
    const key = randomUUID();
    const payload = {
      sku: 'SKU-001',
      quantity: 5,
      referenceType: 'checkout',
      referenceId: 'co-9',
      idempotencyKey: key,
    };
    const first = await agent.post('/api/v1/inventory/reservations').send(payload);
    expect(first.status).toBe(201);
    const second = await agent.post('/api/v1/inventory/reservations').send(payload);
    expect(second.status).toBe(201);
    expect(second.body.data.reservation.id).toBe(first.body.data.reservation.id);

    const detail = await agent.get('/api/v1/inventory?sku=SKU-001');
    expect(detail.body.data.records[0].reserved).toBe(5);

    const conflict = await agent
      .post('/api/v1/inventory/reservations')
      .send({ ...payload, quantity: 6 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('rejects oversell, bad quantities, and invalid transitions', async () => {
    const agent = request(app());
    const oversell = await agent.post('/api/v1/inventory/reservations').send({
      sku: 'SKU-001',
      quantity: 1000,
      referenceType: 'checkout',
      referenceId: 'co-x',
      idempotencyKey: randomUUID(),
    });
    expect(oversell.status).toBe(409);
    expect(oversell.body.error.code).toBe('INSUFFICIENT_STOCK');

    expect(
      (
        await agent.post('/api/v1/inventory/reservations').send({
          sku: 'SKU-001',
          quantity: 0,
          referenceType: 'checkout',
          referenceId: 'co-x',
          idempotencyKey: randomUUID(),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await agent.post('/api/v1/inventory/reservations').send({
          sku: 'SKU-001',
          quantity: 1.5,
          referenceType: 'checkout',
          referenceId: 'co-x',
          idempotencyKey: randomUUID(),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await agent
          .post('/api/v1/inventory/adjust')
          .send({ sku: 'SKU-001', delta: 1.5, reason: 'RECEIPT' })
      ).status,
    ).toBe(400);
    expect(
      (
        await agent
          .post('/api/v1/inventory/adjust')
          .send({ sku: 'SKU-001', delta: 5, reason: 'HACK' })
      ).status,
    ).toBe(400);
    expect(
      (
        await agent
          .post('/api/v1/inventory/adjust')
          .send({ sku: 'SKU-001', delta: 5, reason: 'RECEIPT', onHand: 999 })
      ).status,
    ).toBe(400);

    const reserved = await agent.post('/api/v1/inventory/reservations').send({
      sku: 'SKU-001',
      quantity: 2,
      referenceType: 'checkout',
      referenceId: 'co-t',
      idempotencyKey: randomUUID(),
    });
    const id = reserved.body.data.reservation.id as string;
    await agent.post(`/api/v1/inventory/reservations/${id}/release`).send({});
    const badConfirm = await agent.post(`/api/v1/inventory/reservations/${id}/confirm`).send({});
    expect(badConfirm.status).toBe(404);
  });

  it('enforces authentication and staff/admin authorization', async () => {
    const anon = request(app('none'));
    expect((await anon.get('/api/v1/inventory')).status).toBe(401);
    expect(
      (
        await anon
          .post('/api/v1/inventory/adjust')
          .send({ sku: 'SKU-001', delta: 1, reason: 'RECEIPT' })
      ).status,
    ).toBe(401);

    const customer = request(app('customer'));
    expect((await customer.get('/api/v1/inventory')).status).toBe(403);
    expect(
      (
        await customer
          .post('/api/v1/inventory/adjust')
          .send({ sku: 'SKU-001', delta: 1, reason: 'RECEIPT' })
      ).status,
    ).toBe(403);
    expect(
      (
        await customer.post('/api/v1/inventory/reservations').send({
          sku: 'SKU-001',
          quantity: 1,
          referenceType: 'checkout',
          referenceId: 'co-c',
          idempotencyKey: randomUUID(),
        })
      ).status,
    ).toBe(403);
    expect(
      (await customer.post('/api/v1/inventory/reservations/expire-sweep').send({})).status,
    ).toBe(403);
    expect((await customer.get('/api/v1/inventory/availability?sku=SKU-001')).status).toBe(200);
  });

  it('expires due reservations through the sweep boundary', async () => {
    const agent = request(app());
    const reserved = await agent.post('/api/v1/inventory/reservations').send({
      sku: 'SKU-001',
      quantity: 7,
      referenceType: 'checkout',
      referenceId: 'co-s',
      idempotencyKey: randomUUID(),
      ttlSeconds: 60,
    });
    expect(reserved.status).toBe(201);

    const early = await agent.post('/api/v1/inventory/reservations/expire-sweep').send({});
    expect(early.body.data).toMatchObject({ scanned: 0, expired: 0, failed: 0 });

    const stored = reservations.store.get(reserved.body.data.reservation.id as string);
    expect(stored).toBeDefined();
    reservations.store.set(stored!.id, { ...stored!, expiresAt: new Date(Date.now() - 1000) });

    const sweep = await agent.post('/api/v1/inventory/reservations/expire-sweep').send({});
    expect(sweep.body.data).toMatchObject({ scanned: 1, expired: 1, failed: 0 });

    const after = await agent.get(
      `/api/v1/inventory/reservations/${reserved.body.data.reservation.id}`,
    );
    expect(after.body.data.status).toBe('expired');
    const record = await agent.get('/api/v1/inventory?sku=SKU-001');
    expect(record.body.data.records[0].reserved).toBe(0);

    const resweep = await agent.post('/api/v1/inventory/reservations/expire-sweep').send({});
    expect(resweep.body.data).toMatchObject({ scanned: 0, expired: 0, failed: 0 });
  });

  it('holds invariants under 500 concurrent reservations against stock of 100', async () => {
    const catalog = new FakeInventoryCatalog(new Map([['SKU-001', catalogRef()]]));
    const localInventories = new FakeInventoryRepository();
    const localReservations = new FakeReservationRepository();
    const localMovements = new FakeMovementRepository();
    const localEvents = new FakeInventoryEventPublisher();
    const localService = new InventoryService(
      localInventories,
      localReservations,
      localMovements,
      catalog,
      localEvents,
      testLogger,
    );
    localInventories.store.set('SKU-001', makeInventory({ onHand: 100 }));
    const actor = { type: 'system' as const, id: 'load-test' };

    const results = await Promise.all(
      Array.from({ length: 500 }, (_, i) => {
        return localService
          .reserve(
            {
              sku: 'SKU-001',
              quantity: 1,
              referenceType: 'checkout',
              referenceId: `co-${i}`,
              idempotencyKey: randomUUID(),
            },
            actor,
          )
          .then(
            () => 'ok' as const,
            (error: Error) =>
              (error as { code?: string }).code === 'INSUFFICIENT_STOCK'
                ? ('rejected' as const)
                : ('error' as const),
          );
      }),
    );
    const succeeded = results.filter((r) => r === 'ok').length;
    const rejected = results.filter((r) => r === 'rejected').length;
    const errored = results.filter((r) => r === 'error').length;
    const record = (await localInventories.findBySku('SKU-001'))!;

    expect(succeeded).toBe(100);
    expect(rejected).toBe(400);
    expect(errored).toBe(0);
    expect(record.reserved).toBe(100);
    expect(record.onHand).toBe(100);
    expect(record.onHand - record.reserved).toBeGreaterThanOrEqual(0);
    expect(record.reserved).toBeLessThanOrEqual(record.onHand);
  });
});
