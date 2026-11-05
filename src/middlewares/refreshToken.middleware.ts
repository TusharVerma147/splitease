import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/configuration';
import { Errors } from '../common/errors';
import { RefreshTokenPayload } from '../interfaces';

/** Verifies the x-refresh-token header (only used by POST /auth/refresh). */
export function refreshTokenMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers['x-refresh-token'];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) return next(Errors.unauthorized('x-refresh-token header is required'));

  try {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (!payload.sub || !payload.sid || !payload.jti) return next(Errors.unauthorized());
    req.refreshPayload = payload;
    next();
  } catch {
    // Expired or tampered refresh tokens both mean: log in again.
    next(Errors.unauthorized('Invalid or expired refresh token'));
  }
}
