import './interfaces';
import { logger } from './logger/logger';
import { connectDatabase, closeDatabase } from './providers/database/database.provider';
import { connectRedis, closeRedis } from './providers/redis/redis.provider';
import { connectRabbitMQ, closeRabbitMQ } from './providers/rabbitmq/rabbitmq.provider';

async function startConsumer(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  await connectRabbitMQ();

  logger.info('Consumer started. Waiting for messages...');
}

async function shutdown(): Promise<void> {
  logger.info('Consumer shutting down...');
  await closeDatabase();
  await closeRedis();
  await closeRabbitMQ();
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });

startConsumer().catch((err) => {
  logger.error('Consumer failed to start', { err });
  process.exit(1);
});
