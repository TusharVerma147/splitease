import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';
import { Errors } from '../common/errors';

export type ValidationSource = 'body' | 'query' | 'params';

/** Runs a zod schema on the request body (default), query string or route params. */
export function validate(schema: ZodTypeAny, source: ValidationSource = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.length ? `${source}.${i.path.join('.')}` : source}: ${i.message}`)
        .join('; ');
      next(Errors.validationError(messages));
      return;
    }
    if (source === 'body') req.body = result.data as unknown;
    if (source === 'query') req.query = result.data as typeof req.query;
    next();
  };
}
