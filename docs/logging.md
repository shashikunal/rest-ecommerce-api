# Logging — Phase 8

## Structured Logging

All logs are structured JSON in production and key-value pairs in development.

### Log Format (Production)

```json
{
  "timestamp": "2024-01-15T10:00:00.000Z",
  "level": "info",
  "message": "HTTP request",
  "service": "rest-mock-apis",
  "environment": "production",
  "correlationId": "abc-123",
  "method": "GET",
  "path": "/api/v1/users",
  "statusCode": 200,
  "durationMs": 45
}
```

### Log Format (Development)

```
timestamp=2024-01-15T10:00:00.000Z level=info message=HTTP request service=rest-mock-apis environment=development correlationId=abc-123 method=GET path=/api/v1/users statusCode=200 durationMs=45
```

## Log Levels

- `debug` — Detailed diagnostic information
- `info` — Operational events (requests, connections)
- `warn` — Potentially problematic situations (rate limiter errors, slow queries)
- `error` — Error conditions (exceptions, failures)

## Sensitive Data Protection

The logger automatically redacts sensitive fields:

- `authorization` — Redacted to `[REDACTED]`
- `cookie` — Redacted to `[REDACTED]`
- Any field containing `token`, `password`, `otp`, `secret` — Redacted
- Request/response bodies — Not logged by default
- Authorization headers — Never logged

## Correlation ID Propagation

Every log entry includes the `correlationId` when available. This enables:
- Tracing requests across service boundaries
- Debugging distributed transactions
- Audit trail correlation
- Support ticket identification

## Logger Creation

```typescript
import { createLogger } from './config/logger.js';
import { getEnv } from './config/env.js';

const config = getEnv();
const logger = createLogger(config, 'rest-mock-apis');

logger.info('Server starting', { port: config.PORT });
logger.error('Connection failed', { error: err.message });
```

## Observability Integration

The foundation provides a metrics collector for future observability:

```typescript
import { initializeObservability } from './infrastructure/observability/index.js';

const { metrics, trace } = initializeObservability(config, logger);
metrics.increment('requests_total', { method: 'GET' });
metrics.timing('request_duration', 45);
```

## Log Redaction Summary

| Data Type | Logged? | Example |
|-----------|---------|---------|
| Request method/path | Yes | `GET /api/v1/users` |
| Status code | Yes | `200` |
| Duration | Yes | `45ms` |
| Correlation ID | Yes | `abc-123` |
| Authorization header | No | `[REDACTED]` |
| Cookie | No | `[REDACTED]` |
| Password | No | `[REDACTED]` |
| OTP | No | `[REDACTED]` |
| Payment data | No | `[REDACTED]` |
| Request body | No | (not logged) |
| Response body | No | (not logged) |