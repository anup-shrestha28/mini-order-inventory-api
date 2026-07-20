import rateLimit, { Options } from 'express-rate-limit';
import env from '../config/env';

/**
 * Factory for a rate limiter that emits the API's consistent error envelope on
 * 429 (instead of express-rate-limit's plain-text default). Window/limit come
 * from env; overrides let tests use a tiny limit.
 */
export function createRateLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true, // emit RateLimit-* headers
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests — please try again later.',
        },
      });
    },
    ...overrides,
  });
}

export const apiRateLimiter = createRateLimiter();
