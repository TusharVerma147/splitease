import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/configuration';
import { Errors } from '../common/errors';
import { sendError } from '../common/responses';

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
}

export async function refreshTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers['x-refresh-token'] as string | undefined;
  if (!token) {
    const err = Errors.unauthorized();
    sendError(res, err.statusCode, err.code, err.message, req.requestId);
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    (req as Request & { refreshPayload?: RefreshTokenPayload }).refreshPayload = payload;
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
