import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

/**
 * Runs a Zod schema against a request part and replaces it with the parsed
 * (coerced, stripped) result. Validation failures become a consistent 400
 * with structured `details`, handled centrally. Schema-based validation on
 * every write endpoint — not ad-hoc checks.
 */
export const validate =
  (schema: ZodTypeAny, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      next(new ApiError(400, 'Validation failed', { code: 'VALIDATION_ERROR', details }));
      return;
    }

    req[source] = result.data;
    next();
  };
