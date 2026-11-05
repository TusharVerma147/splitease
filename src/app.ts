import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './config/configuration';
import { headerValidator } from './middlewares/header.validator';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import { logger } from './logger/logger';
import { asyncHandler } from './common/utils';
import { redisService } from './providers/redis/redis.service';
import { healthCheck as rabbitHealthCheck } from './providers/rabbitmq/rabbitmq.provider';
import v1Router from './app.routes';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'device_id',
      'device_type',
      'timezone',
      'lang',
      'x-refresh-token',
    ],
    // Without this the browser cannot read the tokens from the response headers.
    exposedHeaders: ['x-access-token', 'x-refresh-token', 'x-request-id'],
  }),
);

// Correlation id: reuse the caller's, or mint one. Echoed back and used in logs + error bodies.
app.use((req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.use(express.json({ limit: '100kb' }));

morgan.token('id', (req) => (req as Request).requestId ?? '-');
app.use(
  morgan(':id :method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }),
);

// The only route exempt from the device headers.
app.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const [redisOk, rabbitOk] = await Promise.all([redisService.ping(), rabbitHealthCheck()]);
    const mongoOk = mongoose.connection.readyState === 1;
    const healthy = mongoOk && redisOk && rabbitOk;
    res.status(healthy ? 200 : 503).json({ mongo: mongoOk, redis: redisOk, rabbitmq: rabbitOk });
  }),
);

app.use('/api', headerValidator);
app.use('/api/v1', v1Router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
