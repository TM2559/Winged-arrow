import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

/** Extended Request with validated payloads (set by validation middleware) */
export interface ValidatedRequest extends Request {
  validatedBody?: unknown;
  validatedQuery?: unknown;
}

function formatZodErrors(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
  }));
}

/**
 * Returns middleware that validates req.body with the given Zod schema.
 * On success, sets req.validatedBody to the parsed value and calls next().
 * On failure, sends 400 with { error: 'Validation failed', details: [...] }.
 */
export function validateBody<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      (req as ValidatedRequest).validatedBody = result.data;
      next();
      return;
    }
    res.status(400).json({
      error: 'Validation failed',
      details: formatZodErrors(result.error),
    });
  };
}

/**
 * Returns middleware that validates req.query with the given Zod schema.
 * On success, sets req.validatedQuery to the parsed value and calls next().
 * On failure, sends 400 with { error: 'Validation failed', details: [...] }.
 */
export function validateQuery<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (result.success) {
      (req as ValidatedRequest).validatedQuery = result.data;
      next();
      return;
    }
    res.status(400).json({
      error: 'Validation failed',
      details: formatZodErrors(result.error),
    });
  };
}
