import './interfaces';
import { Server } from 'http';
import { config } from './config/configuration';
import { logger } from './logger/logger';
import { SHUTDOWN_TIMEOUT_MS } from './common/constant';
import { connectDatabase, closeDatabase } from './providers/database/database.provider';
import { connectRedis, closeRedis } from './providers/redis/redis.provider';
import { connectRabbitMQ, closeRabbitMQ } from './providers/rabbitmq/rabbitmq.provider';
import { workerThreadService } from './providers/workerThread/worker-thread.service';
import app from './app';

let server: Server | undefined;
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  await connectRabbitMQ();

  server = app.listen(config.PORT, () => {
    logger.info(`SplitEase API running on port ${config.PORT}`);
  });
}

/** SIGTERM: stop accepting requests, let in-flight ones finish, then close workers, RabbitMQ, Redis, Mongo. */
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  const forceTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    if (server) {
      const httpServer = server;
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeIdleConnections();
      });
    }
    await workerThreadService.shutdown();
    await closeRabbitMQ();
    await closeRedis();
    await closeDatabase();
    logger.info('All connections closed. Bye!');
    process.exit(exitCode);
  } catch (err) {
    logger.error('Error during shutdown', { err });
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

bootstrap().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
