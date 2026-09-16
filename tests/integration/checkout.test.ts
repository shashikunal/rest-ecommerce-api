import { randomUUID } from 'crypto';

import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { createApp } from '../../src/app/app';
import { envSchema } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';
import type { AuthRequest } from '../../src/modules/auth/middleware/auth.middleware';
import { CheckoutService } from '../../src/modules/checkout/application/CheckoutService';
import { createCheckoutRoutes } from '../../src/modules/checkout/presentation/routes/checkout.routes';
import {
  FakeCheckoutAddress,
  FakeCheckoutCart,
  FakeCheckoutCatalog,
  FakeCheckoutInventory,
  FakeCheckoutPricing,
  FakeCheckoutRepository,
  FakeCheckoutUser,
  cartSnapshot,
  defaultCustomer,
  priceLine,
} from '../helpers/checkout-fakes';
import { testLogger } from '../helpers/fakes';

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

function stubAuth(mode: 'user' | 'none' = 'user') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = (req.headers['x-test-role'] as string | undefined) ?? mode;
    if (role === 'none') {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access token required' },
      });
      return;
    }
    const userId = (req.headers['x-test-user'] as string | undefined) ?? 'user-checkout-1';
    req.user = {
      id: userId,
      email: `${userId}@example.com`,
      roles: role === 'admin' ? ['admin'] : role === 'system' ? ['system'] : ['user'],
      sessionId: 'sess-1',
      correlationId: req.correlationId ?? '',
    };
    next();
  };
}

function validBody() {
  return {
    shippingAddress: {
      fullName: 'Ada Lovelace',
      phone: '+10000000000',
      line1: '1 Algorithm Ave',
      city: 'London',
      region: 'LDN',
      postalCode: 'E1 6AN',
      country: 'GB',
    },
  };
}

describe('Checkout API', () => {
  let checkouts!: FakeCheckoutRepository;
  let carts!: FakeCheckoutCart;
  let catalog!: FakeCheckoutCatalog;
  let inventory!: FakeCheckoutInventory;

  function app(mode: 'user' | 'none' = 'user') {
    carts = carts ?? new FakeCheckoutCart(cartSnapshot());
    catalog = catalog ?? new FakeCheckoutCatalog(new Map([['SKU-001', priceLine()]]));
    inventory = inventory ?? new FakeCheckoutInventory();
    const service = new CheckoutService(
      checkouts,
      carts,
      catalog,
      new FakeCheckoutPricing(),
      new FakeCheckoutAddress(),
      new FakeCheckoutUser(defaultCustomer()),
      inventory,
      testLogger,
    );
    return createApp({
      config,
      logger,
      checkoutRoutes: createCheckoutRoutes({
        checkoutService: service,
        authMiddleware: stubAuth(mode),
        logger,
      }),
    });
  }

  beforeEach(() => {
    checkouts = new FakeCheckoutRepository();
    carts = new FakeCheckoutCart(cartSnapshot());
    catalog = new FakeCheckoutCatalog(new Map([['SKU-001', priceLine()]]));
    inventory = new FakeCheckoutInventory();
  });

  it('creates, reads, validates, reserves, and cancels a checkout', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(validBody());
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('priced');
    expect(created.body.data.pricing.grandTotalMinor).toBe(3998);
    const id = created.body.data.id as string;

    const fetched = await agent.get(`/api/v1/checkout/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.items[0].unitMinor).toBe(1999);

    const validated = await agent.post(`/api/v1/checkout/${id}/validate`).send({});
    expect(validated.status).toBe(200);
    expect(validated.body.data.ok).toBe(true);

    const reserved = await agent.post(`/api/v1/checkout/${id}/reserve`).send({});
    expect(reserved.status).toBe(200);
    expect(reserved.body.data.status).toBe('ready');
    expect(reserved.body.data.reservations).toHaveLength(1);

    const address = await agent.patch(`/api/v1/checkout/${id}/address`).send({
      shippingAddress: { ...validBody().shippingAddress, city: 'Paris' },
      expectedVersion: reserved.body.data.version,
    });
    expect(address.status).toBe(200);
    expect(address.body.data.shippingAddress.city).toBe('Paris');

    const cancelled = await agent.post(`/api/v1/checkout/${id}/cancel`).send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect(inventory.reserved).toHaveLength(0);

    const again = await agent.post(`/api/v1/checkout/${id}/cancel`).send({});
    expect(again.body.data.status).toBe('cancelled');
  });

  it('requires Idempotency-Key and rejects price tampering', async () => {
    const agent = request(app());
    const missing = await agent.post('/api/v1/checkout').send(validBody());
    expect(missing.status).toBe(400);

    const tampered = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send({ ...validBody(), pricing: { grandTotalMinor: 1 }, total: 1 });
    expect(tampered.status).toBe(400);

    const userSpoof = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send({ ...validBody(), userId: 'someone-else' });
    expect(userSpoof.status).toBe(400);
  });

  it('replays duplicate creates on the same key', async () => {
    const agent = request(app());
    const key = randomUUID();
    const first = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', key)
      .send(validBody());
    expect(first.status).toBe(201);
    const second = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', key)
      .send(validBody());
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('reports price changes through validate with 422', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(validBody());
    const id = created.body.data.id as string;
    catalog.setLine('SKU-001', priceLine({ unitMinor: 2499 }));

    const validated = await agent.post(`/api/v1/checkout/${id}/validate`).send({});
    expect(validated.status).toBe(422);
    expect(validated.body.data.ok).toBe(false);
    expect(validated.body.data.issues[0].code).toBe('PRICE_CHANGED');

    const reserve = await agent.post(`/api/v1/checkout/${id}/reserve`).send({});
    expect(reserve.status).toBe(409);
  });

  it('compensates partial reservation failure', async () => {
    carts.setSnapshot(cartSnapshot());
    catalog.setLine('SKU-002', priceLine({ sku: 'SKU-002', unitMinor: 500 }));
    carts.setSnapshot({
      cartId: 'cart-2',
      version: 1,
      status: 'active',
      currency: 'USD',
      items: [
        {
          sku: 'SKU-001',
          productId: 'p1',
          variantId: 'v1',
          title: 'One',
          quantity: 1,
          unitMinor: 1999,
          currency: 'USD',
        },
        {
          sku: 'SKU-002',
          productId: 'p1',
          variantId: 'v2',
          title: 'Two',
          quantity: 1,
          unitMinor: 500,
          currency: 'USD',
        },
      ],
    });
    inventory.failSkus.add('SKU-002');
    const agent = request(app());
    const created = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(validBody());
    expect(created.status).toBe(201);
    const reserve = await agent.post(`/api/v1/checkout/${created.body.data.id}/reserve`).send({});
    expect(reserve.status).toBe(409);
    expect(inventory.reserved).toHaveLength(0);
    expect(inventory.released).toHaveLength(1);
  });

  it('isolates checkouts per user (BOLA) and requires auth', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(validBody());
    const id = created.body.data.id as string;

    expect((await agent.get(`/api/v1/checkout/${id}`).set('x-test-user', 'user-b')).status).toBe(
      404,
    );
    expect(
      (await agent.post(`/api/v1/checkout/${id}/cancel`).set('x-test-user', 'user-b').send({}))
        .status,
    ).toBe(404);

    const anon = request(app('none'));
    expect((await anon.get(`/api/v1/checkout/${id}`)).status).toBe(401);
    expect((await anon.post('/api/v1/checkout').send(validBody())).status).toBe(401);
  });

  it('expires checkouts through the sweep boundary', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(validBody());
    const id = created.body.data.id as string;
    await agent.post(`/api/v1/checkout/${id}/reserve`).send({});
    const stored = checkouts.store.get(id)!;
    checkouts.store.set(id, { ...stored, expiresAt: new Date(Date.now() - 1000) });

    const sweepDenied = await agent.post('/api/v1/checkout/expire-sweep').send({});
    expect(sweepDenied.status).toBe(403);

    const sweep = await agent
      .post('/api/v1/checkout/expire-sweep')
      .set('x-test-role', 'admin')
      .send({});
    expect(sweep.body.data).toMatchObject({ scanned: 1, expired: 1, failed: 0 });
    expect((await agent.get(`/api/v1/checkout/${id}`)).body.data.status).toBe('expired');
    expect(inventory.reserved).toHaveLength(0);
  });

  it('rejects stale address versions with 409', async () => {
    const agent = request(app());
    const created = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(validBody());
    const id = created.body.data.id as string;
    const stale = await agent.patch(`/api/v1/checkout/${id}/address`).send({
      shippingAddress: validBody().shippingAddress,
      expectedVersion: 999,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CHECKOUT_CONFLICT');
  });
});
