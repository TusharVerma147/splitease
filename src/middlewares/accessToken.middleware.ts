import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/configuration';
import { redisService } from '../providers/redis/redis.service';
import { Errors } from '../common/errors';
import { sendError } from '../common/responses';

interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export async function accessTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = Errors.unauthorized();
    sendError(res, err.statusCode, err.code, err.message, req.requestId);
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;

    const sessionUserId = await redisService.getSession(payload.sid);
    if (!sessionUserId) {
      const err = Errors.unauthorized();
      sendError(res, err.statusCode, err.code, err.message, req.requestId);
      return;
    }

    req.user = { userId: payload.sub, sessionId: payload.sid };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      const e = Errors.tokenExpired();
      sendError(res, e.statusCode, e.code, e.message, req.requestId);
      return;
    }
    const e = Errors.unauthorized();
    sendError(res, e.statusCode, e.code, e.message, req.requestId);
  }
}
