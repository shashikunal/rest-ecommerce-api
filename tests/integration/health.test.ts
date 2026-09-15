import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../../src/app/app';
import { envSchema } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';

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

describe('HTTP foundation', () => {
  it('GET /health returns ok without dependencies', async () => {
    const app = createApp({ config, logger });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/live returns alive', async () => {
    const app = createApp({ config, logger });
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });

  it('accepts and echoes valid correlation ID', async () => {
    const app = createApp({ config, logger });
    const cid = '123e4567-e89b-42d3-a456-426614174000';
    const res = await request(app).get('/health/live').set('x-correlation-id', cid);
    expect(res.headers['x-correlation-id']).toBe(cid);
  });

  it('generates correlation ID when invalid', async () => {
    const app = createApp({ config, logger });
    const res = await request(app).get('/health/live').set('x-correlation-id', 'bad');
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).not.toBe('bad');
  });

  it('returns standardized 404 contract', async () => {
    const app = createApp({ config, logger });
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.correlationId).toBeDefined();
  });

  it('serves versioned API root', async () => {
    const app = createApp({ config, logger });
    const res = await request(app).get('/api/v1/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });

  it('serves openapi.json contract', async () => {
    const app = createApp({ config, logger });
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.components.securitySchemes.bearerAuth).toBeDefined();
  });
});
