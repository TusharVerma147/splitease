import { redisService } from '../providers/redis/redis.service';
import { config } from '../config/configuration';
import { Errors } from '../common/errors';
import { asyncHandler } from '../common/utils';

/** Login rate limit: LOGIN_RATE_LIMIT_MAX tries per window, per email + IP. */
export const loginRateLimit = asyncHandler(async (req, _res, next) => {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const ip = req.ip ?? 'unknown';

  const count = await redisService.incrementLoginAttempts(email, ip, config.LOGIN_RATE_LIMIT_WINDOW_MS);
  if (count > config.LOGIN_RATE_LIMIT_MAX) throw Errors.tooManyAttempts();

  next();
});
