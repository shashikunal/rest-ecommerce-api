import {
  Kafka as KafkaJs,
  type KafkaConfig,
  type Producer,
  type Consumer,
  type KafkaMessage,
} from 'kafkajs';

import {
  KAFKA_CONNECTION_TIMEOUT,
  KAFKA_REQUEST_TIMEOUT,
  KAFKA_RETRY_ATTEMPTS,
} from '../shared/constants/index';
import { AppError } from '../shared/errors/app-error';
import { ERROR_CODES } from '../shared/errors/error-codes';

import type { EnvConfig } from './env';
import type { Logger } from './logger';

let _kafka: KafkaJs | null = null;
let _producer: Producer | null = null;
let _consumer: Consumer | null = null;

export interface KafkaTopicConfig {
  topic: string;
  partitions: number;
  replicationFactor: number;
  configEntries?: Array<{ name: string; value: string }>;
}

export function createKafkaClient(config: EnvConfig, logger: Logger): KafkaJs {
  if (_kafka) {
    logger.info('Kafka client already exists');
    return _kafka;
  }

  const brokers = config.KAFKA_BROKERS.split(',').map((b) => b.trim());

  logger.info('Creating Kafka client...', {
    brokers: brokers.map(() => '***'),
    clientId: config.KAFKA_CLIENT_ID,
  });

  const kafkaConfig: KafkaConfig = {
    brokers,
    clientId: config.KAFKA_CLIENT_ID,
    retry: {
      retries: KAFKA_RETRY_ATTEMPTS,
      initialRetryTime: 300,
      maxRetryTime: 30000,
    },
    connectionTimeout: KAFKA_CONNECTION_TIMEOUT,
    authenticationTimeout: KAFKA_CONNECTION_TIMEOUT,
    ...(config.KAFKA_USERNAME && config.KAFKA_PASSWORD
      ? {
          sasl: {
            mechanism: 'plain',
            username: config.KAFKA_USERNAME,
            password: config.KAFKA_PASSWORD,
          },
          ssl: true,
        }
      : {}),
  };

  try {
    _kafka = new KafkaJs(kafkaConfig);
    logger.info('Kafka client created successfully');
    return _kafka;
  } catch (error) {
    const kafkaError = error as Error;
    logger.error('Kafka client creation failed', { error: kafkaError.message });
    throw new AppError({
      code: ERROR_CODES.KAFKA_ERROR,
      message: 'Failed to create Kafka client',
      cause: kafkaError,
      isOperational: false,
    });
  }
}

export async function createProducer(config: EnvConfig, logger: Logger): Promise<Producer> {
  if (_producer) {
    logger.info('Kafka producer already exists');
    return _producer;
  }

  const kafka = _kafka || createKafkaClient(config, logger);

  logger.info('Creating Kafka producer...');

  try {
    _producer = kafka.producer({
      allowAutoTopicCreation: false,
    });

    await _producer.connect();
    logger.info('Kafka producer connected');
    return _producer;
  } catch (error) {
    const kafkaError = error as Error;
    logger.error('Kafka producer connection failed', { error: kafkaError.message });
    throw new AppError({
      code: ERROR_CODES.KAFKA_ERROR,
      message: 'Failed to connect Kafka producer',
      cause: kafkaError,
      isOperational: false,
    });
  }
}

export async function createConsumer(
  config: EnvConfig,
  groupId: string,
  logger: Logger,
): Promise<Consumer> {
  if (_consumer) {
    logger.info('Kafka consumer already exists');
    return _consumer;
  }

  const kafka = _kafka || createKafkaClient(config, logger);

  logger.info('Creating Kafka consumer...', { groupId });

  try {
    _consumer = kafka.consumer({
      groupId,
      allowAutoTopicCreation: false,
      retry: {
        retries: KAFKA_RETRY_ATTEMPTS,
        initialRetryTime: 300,
        maxRetryTime: 30000,
      },
    });

    await _consumer.connect();
    logger.info('Kafka consumer connected', { groupId });
    return _consumer;
  } catch (error) {
    const kafkaError = error as Error;
    logger.error('Kafka consumer connection failed', { error: kafkaError.message });
    throw new AppError({
      code: ERROR_CODES.KAFKA_ERROR,
      message: 'Failed to connect Kafka consumer',
      cause: kafkaError,
      isOperational: false,
    });
  }
}

export async function closeProducer(logger: Logger): Promise<void> {
  if (_producer) {
    logger.info('Disconnecting Kafka producer...');
    try {
      await _producer.disconnect();
      _producer = null;
      logger.info('Kafka producer disconnected');
    } catch (error) {
      const kafkaError = error as Error;
      logger.error('Error disconnecting Kafka producer', { error: kafkaError.message });
      throw kafkaError;
    }
  }
}

export async function closeConsumer(logger: Logger): Promise<void> {
  if (_consumer) {
    logger.info('Disconnecting Kafka consumer...');
    try {
      await _consumer.disconnect();
      _consumer = null;
      logger.info('Kafka consumer disconnected');
    } catch (error) {
      const kafkaError = error as Error;
      logger.error('Error disconnecting Kafka consumer', { error: kafkaError.message });
      throw kafkaError;
    }
  }
}

export async function closeKafka(logger: Logger): Promise<void> {
  await closeProducer(logger);
  await closeConsumer(logger);
  if (_kafka) {
    _kafka = null;
    logger.info('Kafka client closed');
  }
}

export function getKafkaClient(): KafkaJs | null {
  return _kafka;
}

export function getProducer(): Producer | null {
  return _producer;
}

export function getConsumer(): Consumer | null {
  return _consumer;
}

export function isKafkaConnected(): boolean {
  return _kafka !== null && _producer !== null;
}
