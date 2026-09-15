# Configuration Reference — Phase 8

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development`, `production`, `staging` |
| `PORT` | Server port | `3000` |
| `API_BASE_URL` | Full API base URL | `http://localhost:3000` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `KAFKA_BROKERS` | Comma-separated Kafka brokers | `localhost:9092` |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `rest-mock-apis` |
| `KAFKA_GROUP_ID` | Kafka consumer group ID | `rest-mock-apis-group` |
| `JWT_ACCESS_SECRET` | JWT access token secret (≥32 chars) | `a-very-long-random-string` |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (≥32 chars) | `another-very-long-string` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | - | SMTP server host |
| `SMTP_PORT` | `1025` | SMTP server port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASSWORD` | - | SMTP password |
| `SMTP_FROM` | `noreply@example.com` | Default sender email |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `LOG_LEVEL` | `debug` | Logging level |
| `SWAGGER_ENABLED` | `true` | Enable OpenAPI/Swagger |
| `FEATURE_SWAGGER_UI` | `true` | Enable Swagger UI |
| `FEATURE_DEBUG_ENDPOINTS` | `false` | Enable debug endpoints |
| `IDEMPOTENCY_TTL` | `86400` | Idempotency key TTL in seconds |
| `RATE_LIMITER_REDIS_TTL` | `60` | Rate limiter window in seconds |

### Security Notes

- **Never commit `.env` files** to version control
- **Never hardcode secrets** in source code
- **Fail fast** on missing required configuration
- **Use environment-specific values** for development/staging/production
- **Secret rotation** should be supported via environment variable changes

## Configuration Validation

The application validates ALL environment variables at startup using Zod schemas:

```typescript
// Example validation
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  // ...
});
```

This ensures:
- Type safety throughout the application
- Fast failure on invalid configuration
- No runtime surprises from missing or malformed config
- Centralized configuration access (no `process.env` scattered in business code)

## Runtime Configuration

Once validated, configuration is accessed via `getEnv()`:

```typescript
import { getEnv } from './config/env.js';

const config = getEnv();
const port = config.PORT;
const mongoUri = config.MONGODB_URI;
```

This is the **only** way to access configuration in application code.

## Timeouts

| Resource | Timeout | Behavior |
|----------|---------|----------|
| MongoDB connection | 10s | Startup-critical |
| MongoDB server selection | 5s | Per-operation |
| MongoDB socket | 5s | Per-operation |
| Redis connect | 10s | Startup-critical |
| Redis command | 3s | Per-operation |
| Kafka connection | 10s | Non-critical |
| Kafka request | 30s | Per-operation |
| Server shutdown | 30s | Graceful period |
| HTTP body | 100kb | Per-request |

## Environment Files

Three environment files are expected:

- `.env` — Local development (gitignored)
- `.env.staging` — Staging environment
- `.env.production` — Production environment

Each file follows the same schema but with different values.