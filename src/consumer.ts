import './interfaces';
import { logger } from './logger/logger';
import { SHUTDOWN_TIMEOUT_MS } from './common/constant';
import { connectDatabase, closeDatabase } from './providers/database/database.provider';
import { connectRedis, closeRedis } from './providers/redis/redis.provider';
import { connectRabbitMQ, closeRabbitMQ } from './providers/rabbitmq/rabbitmq.provider';
import { workerThreadService } from './providers/workerThread/worker-thread.service';
import { ConsumerHandle } from './providers/consumers/base.consumer';
import { startBalanceConsumer } from './providers/consumers/balance.consumer';
import { startNotificationConsumer } from './providers/consumers/notification.consumer';
import { startExportConsumer } from './providers/consumers/export.consumer';
import { startDeadLetterConsumer } from './providers/consumers/deadLetter.consumer';

const consumers: ConsumerHandle[] = [];
let shuttingDown = false;

async function startConsumers(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  // If the broker connection drops, exit so the container restarts and re-subscribes.
  await connectRabbitMQ({
    onClose: () => {
      logger.error('RabbitMQ connection lost, exiting so the consumer can restart');
      process.exit(1);
    },
  });

  consumers.push(
    await startBalanceConsumer(),
    await startNotificationConsumer(),
    await startExportConsumer(),
    await startDeadLetterConsumer(),
  );
  logger.info('All consumers started. Waiting for messages...');
}

/** SIGTERM: stop taking messages, finish the current one, then close workers, RabbitMQ, Redis, Mongo. */
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Consumer received ${signal}, shutting down gracefully...`);

  const forceTimer = setTimeout(() => {
    logger.error('Forced consumer shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    await Promise.all(consumers.map((c) => c.stop()));
    await workerThreadService.shutdown();
    await closeRabbitMQ();
    await closeRedis();
    await closeDatabase();
    logger.info('Consumer stopped cleanly');
    process.exit(exitCode);
  } catch (err) {
    logger.error('Error during consumer shutdown', { err });
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err });
  void shutdown('uncaughtException', 1);
});

startConsumers().catch((err) => {
  logger.error('Consumer failed to start', { err });
  process.exit(1);
});
