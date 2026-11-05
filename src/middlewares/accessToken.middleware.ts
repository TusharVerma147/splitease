import jwt from 'jsonwebtoken';
import { config } from '../config/configuration';
import { redisService } from '../providers/redis/redis.service';
import { Errors } from '../common/errors';
import { asyncHandler } from '../common/utils';

interface AccessTokenPayload {
  sub: string;
  sid: string;
}

/** Verifies the Bearer JWT and that its session still exists in Redis (instant logout). */
export const accessTokenMiddleware = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw Errors.unauthorized();

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(authHeader.slice(7), config.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw Errors.tokenExpired();
    throw Errors.unauthorized();
  }

  if (!payload.sub || !payload.sid) throw Errors.unauthorized();

  const sessionUserId = await redisService.getSession(payload.sid);
  if (!sessionUserId || sessionUserId !== payload.sub) throw Errors.unauthorized();

  req.user = { userId: payload.sub, sessionId: payload.sid };
  next();
});
