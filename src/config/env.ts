import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_TEST_URI: z.string().optional(),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  REDIS_PASSWORD: z.string().optional(),

  KAFKA_BROKERS: z.string().min(1, 'KAFKA_BROKERS is required'),
  KAFKA_CLIENT_ID: z.string().min(1, 'KAFKA_CLIENT_ID is required'),
  KAFKA_GROUP_ID: z.string().min(1, 'KAFKA_GROUP_ID is required'),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  MAX_SESSIONS_PER_USER: z.coerce.number().int().positive().default(10),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_DURATION_MS: z.coerce.number().int().positive().default(900000),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().positive().default(8),
  PASSWORD_MAX_LENGTH: z.coerce.number().int().positive().default(128),

  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().default('noreply@example.com'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),

  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  FEATURE_SWAGGER_UI: z.coerce.boolean().default(true),
  FEATURE_DEBUG_ENDPOINTS: z.coerce.boolean().default(false),

  IDEMPOTENCY_TTL: z.coerce.number().int().positive().default(86400),
  RATE_LIMITER_REDIS_TTL: z.coerce.number().int().positive().default(60),

  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _env: EnvConfig | null = null;

export function validateEnv(source: Record<string, string | undefined> = process.env): EnvConfig {
  if (_env) return _env;

  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n')}`,
    );
  }

  _env = result.data;
  return _env;
}

export function getEnv(): EnvConfig {
  return validateEnv();
}

export function resetEnvCache(): void {
  _env = null;
}
