import './interfaces';
import { logger } from './logger/logger';
import { connectDatabase, closeDatabase } from './providers/database/database.provider';
import { connectRedis, closeRedis } from './providers/redis/redis.provider';
import { connectRabbitMQ, closeRabbitMQ } from './providers/rabbitmq/rabbitmq.provider';
import { startBalanceConsumer } from './providers/consumers/balance.consumer';
import { startNotificationConsumer } from './providers/consumers/notification.consumer';
import { startExportConsumer } from './providers/consumers/export.consumer';
import { startDeadLetterConsumer } from './providers/consumers/deadLetter.consumer';

async function startConsumer(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  await connectRabbitMQ();

  await startBalanceConsumer();
  await startNotificationConsumer();
  await startExportConsumer();
  await startDeadLetterConsumer();

  logger.info('All consumers started. Waiting for messages...');
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
