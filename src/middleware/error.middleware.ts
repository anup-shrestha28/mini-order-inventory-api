import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import env from '../config/env';

/** Catch-all for unmatched routes -> forwards a 404 to the error handler. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Normalizes known error shapes (Mongoose validation,
 * cast errors, duplicate keys) into the API's consistent error envelope so
 * clients always get `{ success: false, error: { code, message, details? } }`.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let error: ApiError;
  const anyErr = err as { name?: string; code?: number; errors?: Record<string, { path: string; message: string }>; keyValue?: Record<string, unknown>; path?: string; message?: string; stack?: string };

  if (err instanceof ApiError) {
    error = err;
  } else if (err instanceof ZodError) {
    // Schema validation thrown from a controller/service (e.g. query parsing).
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    error = new ApiError(400, 'Validation failed', { code: 'VALIDATION_ERROR', details });
  } else if (anyErr?.name === 'ValidationError' && anyErr.errors) {
    // Mongoose model-level validation
    const details = Object.values(anyErr.errors).map((e) => ({ field: e.path, message: e.message }));
    error = new ApiError(400, 'Validation failed', { code: 'VALIDATION_ERROR', details });
  } else if (anyErr?.name === 'CastError') {
    error = new ApiError(400, `Invalid value for field '${anyErr.path}'`, { code: 'INVALID_ID' });
  } else if (anyErr?.code === 11000) {
    const field = Object.keys(anyErr.keyValue || {})[0];
    error = new ApiError(409, `Duplicate value for '${field}'`, {
      code: 'DUPLICATE_KEY',
      details: anyErr.keyValue,
    });
  } else {
    // Unknown/unexpected error -> log full detail, expose a safe message.
    logger.error({ err }, 'Unhandled error');
    error = new ApiError(
      500,
      env.NODE_ENV === 'production' ? 'Internal server error' : anyErr?.message || 'Internal server error'
    );
  }

  const payload: {
    success: false;
    error: { code: string; message: string; details?: unknown; stack?: string };
  } = {
    success: false,
    error: { code: error.code, message: error.message },
  };
  if (error.details !== undefined) payload.error.details = error.details;
  if (env.NODE_ENV !== 'production' && error.statusCode >= 500) payload.error.stack = error.stack;

  res.status(error.statusCode || 500).json(payload);
}
