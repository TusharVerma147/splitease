import { Request, Response, NextFunction } from 'express';
import { redisService } from '../providers/redis/redis.service';
import { config } from '../config/configuration';
import { Errors } from '../common/errors';
import { sendError } from '../common/responses';

export async function loginRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const email = (req.body as { email?: string }).email ?? '';
  const ip = req.ip ?? 'unknown';

  const count = await redisService.incrementLoginAttempts(
    email,
    ip,
    config.LOGIN_RATE_LIMIT_WINDOW_MS,
  );

  if (count > config.LOGIN_RATE_LIMIT_MAX) {
    const err = Errors.tooManyAttempts();
    sendError(res, err.statusCode, err.code, err.message, req.requestId);
    return;
  }

  next();
}
