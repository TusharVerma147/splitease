import './interfaces';
import { config } from './config/configuration';
import { logger } from './logger/logger';
import { connectDatabase, closeDatabase } from './providers/database/database.provider';
import { connectRedis, closeRedis } from './providers/redis/redis.provider';
import { connectRabbitMQ, closeRabbitMQ } from './providers/rabbitmq/rabbitmq.provider';
import app from './app';
import { Server } from 'http';

let server: Server;

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  await connectRabbitMQ();

  server = app.listen(config.PORT, () => {
    logger.info(`SplitEase API running on port ${config.PORT}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(async () => {
    await closeDatabase();
    await closeRedis();
    await closeRabbitMQ();
    logger.info('All connections closed. Bye!');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

bootstrap().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
