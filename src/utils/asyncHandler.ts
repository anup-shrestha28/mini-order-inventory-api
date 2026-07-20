import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express handler so rejected promises are forwarded to the
 * central error middleware instead of crashing the process. Lets controllers
 * use plain `async/await` without repetitive try/catch.
 */
export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
