import type { EnvConfig } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  service?: string;
  environment?: string;
  correlationId?: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  errorName?: string;
  errorCode?: string;
  stack?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEY_PARTS = [
  'authorization',
  'cookie',
  'token',
  'password',
  'otp',
  'secret',
  'api-key',
  'passwd',
  'payment',
  'card',
];

function sanitizeMeta(meta: LogMeta): LogMeta {
  const sanitized: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    const lowered = key.toLowerCase();
    if (SENSITIVE_KEY_PARTS.some((part) => lowered.includes(part))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function createLogger(config: EnvConfig, service = 'rest-mock-apis'): Logger {
  const configuredLevel = config.LOG_LEVEL;
  const isProduction = config.NODE_ENV === 'production';

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLevel];
  }

  function formatMessage(level: LogLevel, message: string, meta: LogMeta): string {
    const timestamp = new Date().toISOString();
    const base = {
      timestamp,
      level,
      message,
      service,
      environment: config.NODE_ENV,
    };

    const enriched = { ...base, ...sanitizeMeta(meta) };

    if (isProduction) {
      return JSON.stringify(enriched);
    }

    const metaStr = Object.entries(enriched)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(' ');
    return metaStr;
  }

  function emit(
    level: LogLevel,
    message: string,
    meta: LogMeta | undefined,
    fn: (out: string) => void,
  ): void {
    if (!shouldLog(level)) return;
    fn(formatMessage(level, message, meta ?? {}));
  }

  return {
    debug(message, meta) {
      emit('debug', message, meta, (out) => console.debug(out));
    },
    info(message, meta) {
      emit('info', message, meta, (out) => console.info(out));
    },
    warn(message, meta) {
      emit('warn', message, meta, (out) => console.warn(out));
    },
    error(message, meta) {
      emit('error', message, meta, (out) => console.error(out));
    },
  };
}
