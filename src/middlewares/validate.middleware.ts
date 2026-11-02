import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../common/responses';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      sendError(res, 400, 'VALIDATION_ERROR', messages, req.requestId);
      return;
    }
    req.body = result.data as unknown;
    next();
  };
}
