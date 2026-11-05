import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError, Errors } from '../common/errors';
import { sendError } from '../common/responses';
import { logger } from '../logger/logger';

export function notFoundMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next(Errors.notFound('Route'));
}

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return Errors.validationError(err.issues.map((i) => i.message).join('; '));
  if (err instanceof mongoose.Error.CastError || err instanceof mongoose.Error.ValidationError) {
    return Errors.validationError('Invalid input');
  }
  if (err instanceof Error && err.name === 'BSONError') return Errors.validationError('Invalid id');

  if (typeof err === 'object' && err !== null) {
    const e = err as { type?: string; status?: number };
    if (e.type === 'entity.parse.failed') return Errors.validationError('Request body is not valid JSON');
    if (e.type === 'entity.too.large') return Errors.validationError('Request body is too large');
    if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
      return Errors.validationError('Bad request');
    }
  }
  return null;
}

/** The single place where errors become the error envelope. */
export function errorMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const appError = toAppError(err);
  if (appError) {
    sendError(res, appError.statusCode, appError.code, appError.message, req.requestId);
    return;
  }
  logger.error('Unhandled error', { err, requestId: req.requestId, path: req.originalUrl });
  const internal = Errors.internal();
  sendError(res, internal.statusCode, internal.code, internal.message, req.requestId);
}
