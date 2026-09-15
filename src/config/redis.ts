import { createClient, type RedisClientType } from 'redis';

import {
  REDIS_COMMAND_TIMEOUT,
  REDIS_CONNECT_TIMEOUT,
  REDIS_MAX_RETRIES,
} from '../shared/constants/index';
import { AppError } from '../shared/errors/app-error';
import { ERROR_CODES } from '../shared/errors/error-codes';

import type { EnvConfig } from './env';
import type { Logger } from './logger';

let _client: RedisClientType | null = null;
let _isConnecting = false;

export async function connectRedis(config: EnvConfig, logger: Logger): Promise<RedisClientType> {
  if (_client && _client.isReady) {
    logger.info('Redis connection already established');
    return _client;
  }

  if (_isConnecting) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return connectRedis(config, logger);
  }

  _isConnecting = true;

  logger.info('Connecting to Redis...', {
    url: config.REDIS_URL,
  });

  try {
    const client = createClient({
      url: config.REDIS_URL,
      password: config.REDIS_PASSWORD,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT,
        reconnectStrategy: (retries) => {
          if (retries > REDIS_MAX_RETRIES) {
            logger.error('Redis max reconnection attempts reached');
            return new Error('Redis max reconnection attempts reached');
          }
          return Math.min(retries * 100, 2000);
        },
      },
    });

    client.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });

    client.on('ready', () => {
      logger.info('Redis ready');
    });

    client.on('end', () => {
      logger.info('Redis connection ended');
    });

    client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    await client.connect();

    _client = client as RedisClientType;
    _isConnecting = false;

    logger.info('Redis connected successfully');
    return _client;
  } catch (error) {
    _isConnecting = false;
    const redisError = error as Error;
    logger.error('Redis connection failed', { error: redisError.message });
    throw new AppError({
      code: ERROR_CODES.REDIS_ERROR,
      message: 'Failed to connect to Redis',
      cause: redisError,
      isOperational: false,
    });
  }
}

export async function closeRedis(logger: Logger): Promise<void> {
  if (_client && _client.isReady) {
    logger.info('Closing Redis connection...');
    try {
      await _client.quit();
      _client = null;
      logger.info('Redis connection closed');
    } catch (error) {
      const redisError = error as Error;
      logger.error('Error closing Redis connection', { error: redisError.message });
      throw redisError;
    }
  }
}

export function getRedisClient(): RedisClientType | null {
  return _client;
}

export function isRedisConnected(): boolean {
  return _client !== null && _client.isReady;
}

export async function redisHealthCheck(): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !client.isReady) {
    return false;
  }
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
