import compression from 'compression';
import express, {
  type Response,
  type NextFunction,
  type RequestHandler,
  type ErrorRequestHandler,
} from 'express';
import type { Express } from 'express';
import type { Router } from 'express';

import type { EnvConfig } from '../config/env';
import type { Logger } from '../config/logger';
import type { RateLimiter } from '../infrastructure/redis/rate-limiter';
import { JSON_LIMIT, URL_ENCODED_LIMIT, API_PREFIX, APP_NAME } from '../shared/constants/index';
import { AppError, RateLimitError } from '../shared/errors/app-error';
import { formatErrorResponse, formatUnexpectedError } from '../shared/errors/error-response';
import { HTTP_STATUS } from '../shared/errors/http-status';
import { type AppRequest, asyncHandler } from '../shared/http/response';
import { correlationIdMiddleware } from '../shared/security/correlation-id';
import {
  securityHeaders,
  corsMiddleware,
  requestLoggerMiddleware,
} from '../shared/security/security-middleware';

import { createApiRouter } from './routes/index';

export interface AppDependencies {
  rateLimiter?: RateLimiter;
  logger: Logger;
  config: EnvConfig;
  authRoutes?: Router;
  userRoutes?: Router;
  sessionRoutes?: Router;
  catalogRoutes?: Router;
  cartRoutes?: Router;
  wishlistRoutes?: Router;
  inventoryRoutes?: Router;
  checkoutRoutes?: Router;
}

export function createApp(deps: AppDependencies): Express {
  const {
    config,
    logger,
    rateLimiter,
    authRoutes,
    userRoutes,
    sessionRoutes,
    catalogRoutes,
    cartRoutes,
    wishlistRoutes,
    inventoryRoutes,
    checkoutRoutes,
  } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(correlationIdMiddleware as RequestHandler);
  app.use(securityHeaders);
  app.use(
    corsMiddleware(
      config.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  );
  app.use(requestLoggerMiddleware((msg, meta) => logger.info(msg, meta)));
  app.use(express.json({ limit: JSON_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: URL_ENCODED_LIMIT }));
  app.use(compression());

  if (rateLimiter) {
    app.use(
      asyncHandler(async (req: AppRequest, _res: Response, next: NextFunction) => {
        const identifier = req.ip ?? req.correlationId ?? 'anon';
        const result = await rateLimiter.check(req.method, req.path, identifier);
        if (!result.allowed) {
          throw new RateLimitError(
            'Rate limit exceeded',
            result.retryAfter ?? 60,
            req.correlationId,
          );
        }
        next();
      }),
    );
  }

  setupHealthRoutes(app, config);
  setupSwaggerRoute(app, config, logger);

  app.use(API_PREFIX, createApiRouter(deps));
  if (authRoutes) {
    app.use(`${API_PREFIX}/auth`, authRoutes);
  }
  if (userRoutes) {
    app.use(`${API_PREFIX}/users`, userRoutes);
  }
  if (sessionRoutes) {
    app.use(`${API_PREFIX}/users/me/sessions`, sessionRoutes);
  }
  if (catalogRoutes) {
    app.use(API_PREFIX, catalogRoutes);
  }
  if (cartRoutes) {
    app.use(API_PREFIX, cartRoutes);
  }
  if (wishlistRoutes) {
    app.use(API_PREFIX, wishlistRoutes);
  }
  if (inventoryRoutes) {
    app.use(API_PREFIX, inventoryRoutes);
  }
  if (checkoutRoutes) {
    app.use(API_PREFIX, checkoutRoutes);
  }

  app.use((req: AppRequest, _res: Response, next: NextFunction) => {
    next(
      new AppError({
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        correlationId: req.correlationId,
      }),
    );
  });

  const globalErrorHandler: ErrorRequestHandler = (
    err: AppError | Error,
    req: AppRequest,
    res: Response,

    _next: NextFunction,
  ) => {
    handleGlobalError(err, req, res, logger);
  };
  app.use(globalErrorHandler);
  return app;
}

function setupHealthRoutes(app: Express, config: EnvConfig): void {
  app.get('/health', (_req, res) => {
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: APP_NAME,
      environment: config.NODE_ENV,
    });
  });
  app.get('/health/live', (_req, res) => {
    res.status(HTTP_STATUS.OK).json({ status: 'alive', timestamp: new Date().toISOString() });
  });
  app.get('/health/ready', async (_req, res) => {
    const checks: Record<string, string> = {};
    try {
      const { isDatabaseConnected } = await import('../config/database');
      checks.database = isDatabaseConnected() ? 'ready' : 'not_ready';
    } catch {
      checks.database = 'unknown';
    }
    try {
      const { isRedisConnected } = await import('../config/redis');
      checks.redis = isRedisConnected() ? 'ready' : 'not_ready';
    } catch {
      checks.redis = 'unknown';
    }
    const allReady = Object.values(checks).every((v) => v === 'ready');
    res.status(allReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      status: allReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}

function setupSwaggerRoute(app: Express, config: EnvConfig, logger: Logger): void {
  app.get('/openapi.json', async (_req, res) => {
    try {
      const { generateOpenApiSpec } = await import('../docs/openapi/generator');
      res.json(generateOpenApiSpec(config));
    } catch (err) {
      logger.error('OpenAPI generation failed', { error: (err as Error).message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Unable to generate OpenAPI spec' },
      });
    }
  });
  if (config.NODE_ENV !== 'production' && config.FEATURE_SWAGGER_UI) {
    void import('swagger-ui-express')
      .then((swaggerUi) => {
        void import('../docs/openapi/generator').then(({ generateOpenApiSpec }) => {
          const spec = generateOpenApiSpec(config) as unknown as Record<string, unknown>;
          app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));
        });
      })
      .catch((err: Error) => logger.warn('Swagger UI unavailable', { error: err.message }));
  }
}

function handleGlobalError(
  err: AppError | Error,
  req: AppRequest,
  res: Response,
  logger: Logger,
): void {
  const correlationId = req.correlationId;
  if (err instanceof AppError) {
    if (err.code === 'RATE_LIMITED' && err.details.retryAfter) {
      res.setHeader('Retry-After', String(err.details.retryAfter));
    }
    if (err.statusCode >= 500) {
      logger.error('Application error', { code: err.code, message: err.message, correlationId });
    } else {
      logger.warn('Application error', { code: err.code, message: err.message, correlationId });
    }
    const formatted = formatErrorResponse(err);
    res.status(err.statusCode).json({ ...formatted, error: { ...formatted.error, correlationId } });
  } else {
    logger.error('Unexpected error', { error: err.message, correlationId, stack: err.stack });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatUnexpectedError(err, correlationId));
  }
}
