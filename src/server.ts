import type { Server } from 'http';

import type { Router, RequestHandler } from 'express';

import { createApp } from './app/app';
import { connectDatabase, closeDatabase } from './config/database';
import { validateEnv } from './config/env';
import type { EnvConfig } from './config/env';
import { createKafkaClient, closeKafka, closeConsumer, closeProducer } from './config/kafka';
import { createLogger } from './config/logger';
import type { Logger } from './config/logger';
import { connectRedis, closeRedis } from './config/redis';
import { initializeObservability } from './infrastructure/observability/metrics';
import { createRateLimiter } from './infrastructure/redis/rate-limiter';

let serverInstance: Server | null = null;
let isShuttingDown = false;
let handlersRegistered = false;

export async function startServer(): Promise<{
  server: Server;
  config: EnvConfig;
  logger: Logger;
}> {
  const config = validateEnv();
  const logger = createLogger(config);
  initializeObservability(config, logger);
  await connectDatabase(config, logger);
  await connectRedis(config, logger);
  try {
    createKafkaClient(config, logger);
  } catch (error) {
    logger.warn('Kafka initialization failed (non-critical for HTTP foundation)', {
      error: (error as Error).message,
    });
  }
  const rateLimiter = createRateLimiter(logger, config);
  const { authRoutes, userRoutes, sessionRoutes, catalogRoutes } = await loadOptionalModuleRoutes(
    config,
    logger,
  );
  const app = createApp({
    config,
    logger,
    rateLimiter,
    authRoutes,
    userRoutes,
    sessionRoutes,
    catalogRoutes,
  });
  const PORT = config.PORT;
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, { environment: config.NODE_ENV });
      resolve(s);
    });
    s.on('error', reject);
  });
  serverInstance = server;
  server.setTimeout(config.HTTP_REQUEST_TIMEOUT_MS);
  setupGracefulShutdown(logger, config);
  setupProcessHandlers(logger);
  return { server, config, logger };
}

async function loadOptionalModuleRoutes(
  _config: EnvConfig,
  logger: Logger,
): Promise<{
  authRoutes?: Router;
  userRoutes?: Router;
  sessionRoutes?: Router;
  catalogRoutes?: Router;
}> {
  try {
    const { createAuthDependencies } = await import('./modules/auth/factory');
    const authDeps = createAuthDependencies(_config, logger);
    const shared = {
      userRepository: authDeps.userRepository,
      sessionRepository: authDeps.sessionRepository,
      tokenRepository: authDeps.tokenRepository,
      otpService: authDeps.otpService,
      eventPublisher: authDeps.eventPublisher,
      logger,
      authMiddleware: authDeps.authMiddleware as unknown as RequestHandler,
    };
    let userRoutes: Router | undefined;
    let sessionRoutes: Router | undefined;
    let catalogRoutes: Router | undefined;
    try {
      const { createUsersDependencies } = await import('./modules/users/factory');
      userRoutes = createUsersDependencies(shared).userRoutes;
    } catch (error) {
      logger.warn('Users module unavailable', { error: (error as Error).message });
    }
    try {
      const { createSessionsDependencies } = await import('./modules/sessions/factory');
      sessionRoutes = createSessionsDependencies(shared).sessionRoutes;
    } catch (error) {
      logger.warn('Sessions module unavailable', { error: (error as Error).message });
    }
    try {
      const { createCatalogDependencies } = await import('./modules/catalog/factory');
      catalogRoutes = createCatalogDependencies({
        logger,
        authMiddleware: shared.authMiddleware,
        config: _config,
      }).catalogRoutes;
    } catch (error) {
      logger.warn('Catalog module unavailable', { error: (error as Error).message });
    }
    return { authRoutes: authDeps.authRoutes, userRoutes, sessionRoutes, catalogRoutes };
  } catch {
    return {};
  }
}

function setupGracefulShutdown(logger: Logger, config: EnvConfig): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`${signal} received, starting graceful shutdown...`);
    if (serverInstance) {
      await new Promise<void>((resolve) => serverInstance?.close(() => resolve()));
    }
    const timeout = setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);
    timeout.unref();
    try {
      await closeConsumer(logger);
    } catch (e) {
      logger.error('Kafka consumer close error', { error: (e as Error).message });
    }
    try {
      await closeProducer(logger);
    } catch (e) {
      logger.error('Kafka producer close error', { error: (e as Error).message });
    }
    try {
      await closeKafka(logger);
    } catch (e) {
      logger.error('Kafka close error', { error: (e as Error).message });
    }
    try {
      await closeRedis(logger);
    } catch (e) {
      logger.error('Redis close error', { error: (e as Error).message });
    }
    try {
      await closeDatabase(logger);
    } catch (e) {
      logger.error('MongoDB close error', { error: (e as Error).message });
    }
    clearTimeout(timeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

function setupProcessHandlers(logger: Logger): void {
  if (handlersRegistered) return;
  handlersRegistered = true;
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
    process.exit(1);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err: Error) => {
    console.error(`Startup failed: ${err.message}`);
    process.exit(1);
  });
}
