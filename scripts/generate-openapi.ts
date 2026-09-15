import { writeFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import { envSchema } from '../src/config/env';
import { generateOpenApiSpec } from '../src/docs/openapi/generator';

const config = envSchema.parse({
  MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/dev',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  KAFKA_BROKERS: process.env.KAFKA_BROKERS ?? 'localhost:9092',
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID ?? 'rest-mock-apis',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID ?? 'rest-mock-apis-group',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'a'.repeat(32),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'b'.repeat(32),
});
const spec = generateOpenApiSpec(config);
writeFileSync('docs/openapi/openapi.json', JSON.stringify(spec, null, 2));
console.log('OpenAPI spec written to docs/openapi/openapi.json');
