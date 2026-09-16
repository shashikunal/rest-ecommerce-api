import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { createApp } from '../../src/app/app';
import { envSchema } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';
import type { AuthRequest } from '../../src/modules/auth/middleware/auth.middleware';
import { CartService } from '../../src/modules/cart/application/CartService';
import { createCartRoutes } from '../../src/modules/cart/presentation/routes/cart.routes';
import { WishlistService } from '../../src/modules/wishlist/application/WishlistService';
import { createWishlistRoutes } from '../../src/modules/wishlist/presentation/routes/wishlist.routes';
import {
  FakeCartRepository,
  FakeCartCatalog,
  FakeWishlistRepository,
  FakeWishlistCatalog,
  sellableLine,
  wishlistInfo,
} from '../helpers/cart-wishlist-fakes';
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

function stubAuth(userId: string) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const override = req.headers['x-test-user'] as string | undefined;
    req.user = {
      id: override ?? userId,
      email: `${override ?? userId}@example.com`,
      roles: ['user'],
      sessionId: 'sess-1',
      correlationId: req.correlationId ?? '',
    };
    next();
  };
}

describe('Cart + Wishlist API', () => {
  let carts!: FakeCartRepository;
  let wishlists!: FakeWishlistRepository;

  function app() {
    const catalog = new FakeCartCatalog(
      new Map([
        ['SKU-001', sellableLine()],
        [
          'SKU-002',
          sellableLine({
            sku: 'SKU-002',
            variantId: '223e4567-e89b-42d3-a456-426614174014',
            unitMinor: 500,
          }),
        ],
        ['SKU-OFF', sellableLine({ sku: 'SKU-OFF', purchasable: false })],
      ]),
    );
    const wcat = new FakeWishlistCatalog(new Map([['SKU-001', wishlistInfo()]]));
    const cartService = new CartService(carts, catalog, testLogger);
    const wishlistService = new WishlistService(wishlists, wcat, testLogger);
    return createApp({
      config,
      logger,
      cartRoutes: createCartRoutes({ cartService, authMiddleware: stubAuth('user-a'), logger }),
      wishlistRoutes: createWishlistRoutes({
        wishlistService,
        authMiddleware: stubAuth('user-a'),
        logger,
      }),
    });
  }

  beforeEach(() => {
    carts = new FakeCartRepository();
    wishlists = new FakeWishlistRepository();
  });

  it('runs full cart lifecycle: empty -> add -> merge -> update -> remove -> clear', async () => {
    const agent = request(app());
    expect((await agent.get('/api/v1/cart')).body.data.items).toHaveLength(0);

    const added = await agent.post('/api/v1/cart/items').send({ sku: 'sku-001', qty: 2 });
    expect(added.status).toBe(201);
    const itemId = added.body.data.items[0].itemId as string;
    const version = added.body.data.version as number;

    const merged = await agent.post('/api/v1/cart/items').send({ sku: 'SKU-001', quantity: 1 });
    expect(merged.status).toBe(200);
    expect(merged.body.data.items[0].quantity).toBe(3);

    const stale = await agent
      .patch(`/api/v1/cart/items/${itemId}`)
      .send({ quantity: 2, expectedVersion: version });
    expect(stale.status).toBe(409);

    const current = await agent.get('/api/v1/cart');
    const updated = await agent
      .patch(`/api/v1/cart/items/${itemId}`)
      .send({ quantity: 2, expectedVersion: current.body.data.version });
    expect(updated.status).toBe(200);
    expect(updated.body.data.subtotalMinor).toBe(3998);

    const removed = await agent.delete(`/api/v1/cart/items/${itemId}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.items).toHaveLength(0);

    await agent.post('/api/v1/cart/items').send({ sku: 'SKU-002', quantity: 1 });
    const cleared = await agent.delete('/api/v1/cart');
    expect(cleared.body.data.items).toHaveLength(0);
    expect(cleared.body.data.id).toBeDefined();
  });

  it('rejects client price injection, bad quantities, and unavailable skus', async () => {
    const agent = request(app());
    expect(
      (await agent.post('/api/v1/cart/items').send({ sku: 'SKU-001', quantity: 1, price: 1 }))
        .status,
    ).toBe(400);
    expect(
      (await agent.post('/api/v1/cart/items').send({ sku: 'SKU-001', quantity: 0 })).status,
    ).toBe(400);
    expect(
      (await agent.post('/api/v1/cart/items').send({ sku: 'SKU-001', quantity: 51 })).status,
    ).toBe(400);
    expect(
      (await agent.post('/api/v1/cart/items').send({ sku: 'SKU-001', quantity: 1.5 })).status,
    ).toBe(400);
    expect(
      (await agent.post('/api/v1/cart/items').send({ sku: 'SKU-OFF', quantity: 1 })).status,
    ).toBe(422);
    expect((await agent.post('/api/v1/cart/items').send({ sku: 'NOPE', quantity: 1 })).status).toBe(
      422,
    );
  });

  it('enforces cart ownership (BOLA): user A cannot touch user B items', async () => {
    const agent = request(app());
    const added = await agent.post('/api/v1/cart/items').send({ sku: 'SKU-001', quantity: 1 });
    const itemId = added.body.data.items[0].itemId as string;
    const version = added.body.data.version as number;

    const otherUpdate = await agent
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('x-test-user', 'user-b')
      .send({ quantity: 5, expectedVersion: version });
    expect(otherUpdate.status).toBe(404);

    const otherRemove = await agent
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('x-test-user', 'user-b');
    expect(otherRemove.status).toBe(404);

    const otherCart = await agent.get('/api/v1/cart').set('x-test-user', 'user-b');
    expect(otherCart.body.data.items).toHaveLength(0);
  });

  it('supports wishlist add/list/check/remove with duplicate-safe semantics', async () => {
    const agent = request(app());
    const first = await agent.post('/api/v1/wishlist/items').send({ sku: 'SKU-001' });
    expect(first.status).toBe(201);
    const dup = await agent.post('/api/v1/wishlist/items').send({ sku: 'sku-001' });
    expect(dup.status).toBe(200);
    expect(dup.body.data.itemId).toBe(first.body.data.itemId);

    const list = await agent.get('/api/v1/wishlist?limit=20');
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].state).toBe('AVAILABLE');

    const check = await agent.get(
      '/api/v1/wishlist/check?productId=123e4567-e89b-42d3-a456-426614174013',
    );
    expect(check.body.data.saved).toBe(true);

    await agent.delete(`/api/v1/wishlist/items/${first.body.data.itemId}`).expect(204);
    expect((await agent.get('/api/v1/wishlist')).body.data.items).toHaveLength(0);
  });

  it('isolates wishlists per user', async () => {
    const agent = request(app());
    await agent.post('/api/v1/wishlist/items').send({ sku: 'SKU-001' });
    const other = await agent.get('/api/v1/wishlist').set('x-test-user', 'user-b');
    expect(other.body.data.items).toHaveLength(0);
  });
});
