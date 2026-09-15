import mongoose, { Mongoose } from 'mongoose';

import {
  MONGO_CONNECTION_TIMEOUT,
  MONGO_SERVER_SELECTION_TIMEOUT,
  MONGO_MAX_POOL_SIZE,
  MONGO_MIN_POOL_SIZE,
} from '../shared/constants/index';
import { AppError } from '../shared/errors/app-error';
import { ERROR_CODES } from '../shared/errors/error-codes';

import type { EnvConfig } from './env';
import type { Logger } from './logger';

let _connection: Mongoose | null = null;

export async function connectDatabase(config: EnvConfig, logger: Logger): Promise<Mongoose> {
  if (_connection && _connection.connection.readyState === 1) {
    logger.info('MongoDB connection already established');
    return _connection;
  }

  logger.info('Connecting to MongoDB Atlas...', {
    uri: config.MONGODB_URI.replace(/\/\/(.+):(.+)@/, '//***:***@'),
  });

  try {
    _connection = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT,
      connectTimeoutMS: MONGO_CONNECTION_TIMEOUT,
      maxPoolSize: MONGO_MAX_POOL_SIZE,
      minPoolSize: MONGO_MIN_POOL_SIZE,
      socketTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      autoIndex: config.NODE_ENV !== 'production',
    });

    logger.info('MongoDB connected successfully', {
      host: _connection.connection.host,
      port: _connection.connection.port,
      name: _connection.connection.name,
    });

    return _connection;
  } catch (error) {
    const dbError = error as Error;
    logger.error('MongoDB connection failed', {
      error: dbError.message,
      name: dbError.name,
    });
    throw new AppError({
      code: ERROR_CODES.DB_ERROR,
      message: 'Failed to connect to database',
      cause: dbError,
      isOperational: false,
    });
  }
}

export async function closeDatabase(logger: Logger): Promise<void> {
  if (_connection && _connection.connection.readyState !== 0) {
    logger.info('Closing MongoDB connection...');
    try {
      await _connection.connection.close();
      _connection = null;
      logger.info('MongoDB connection closed');
    } catch (error) {
      const dbError = error as Error;
      logger.error('Error closing MongoDB connection', { error: dbError.message });
      throw dbError;
    }
  }
}

export function getDatabaseConnection(): Mongoose | null {
  return _connection;
}

export function isDatabaseConnected(): boolean {
  return _connection !== null && _connection.connection.readyState === 1;
}
