export const APP_NAME = 'rest-mock-apis';
export const APP_VERSION = '1.0.0';

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const HEALTH_PREFIX = '/health';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const REQUEST_ID_HEADER = 'x-request-id';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const MONGO_CONNECTION_TIMEOUT = 10000;
export const MONGO_SERVER_SELECTION_TIMEOUT = 5000;
export const MONGO_MAX_POOL_SIZE = 50;
export const MONGO_MIN_POOL_SIZE = 5;

export const REDIS_COMMAND_TIMEOUT = 3000;
export const REDIS_CONNECT_TIMEOUT = 10000;
export const REDIS_MAX_RETRIES = 3;

export const KAFKA_REQUEST_TIMEOUT = 30000;
export const KAFKA_CONNECTION_TIMEOUT = 10000;
export const KAFKA_RETRY_ATTEMPTS = 5;

export const SERVER_SHUTDOWN_TIMEOUT = 30000;

export const BODY_LIMIT = '100kb';
export const JSON_LIMIT = '100kb';
export const URL_ENCODED_LIMIT = '100kb';

export const CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173';
export const CORS_CREDENTIALS = true;
export const RATE_LIMITER_REDIS_TTL = 60;
