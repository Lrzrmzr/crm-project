import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { fail } from '../utils/response.utils';

export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      fail(res, result.error.issues[0].message, 422);
      return;
    }
    req.body = (result.data as { body: unknown }).body;
    next();
  };
}