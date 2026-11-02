import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config/configuration';
import { headerValidator } from './middlewares/header.validator';
import { sendError } from './common/responses';
import { AppError } from './common/errors';
import { logger } from './logger/logger';
import { redisService } from './providers/redis/redis.service';
import { healthCheck as rabbitHealthCheck } from './providers/rabbitmq/rabbitmq.provider';
import mongoose from 'mongoose';
import v1Router from './app.routes';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.CORS_ORIGINS.split(','),
    exposedHeaders: ['x-access-token', 'x-refresh-token'],
  }),
);

app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  next();
});

app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: () => false,
  }),
);

app.get('/health', async (_req: Request, res: Response) => {
  const [redisOk, rabbitOk] = await Promise.all([
    redisService.ping(),
    rabbitHealthCheck(),
  ]);
  const mongoOk = mongoose.connection.readyState === 1;
  res.json({ mongo: mongoOk, redis: redisOk, rabbitmq: rabbitOk });
});

app.use('/api', headerValidator);

app.use('/api/v1', v1Router);

app.use((_req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', 'Route not found');
});

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, req.requestId);
    return;
  }
  logger.error('Unhandled error', { err });
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
});

export default app;
