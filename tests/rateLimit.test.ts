import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/middleware/rateLimit.middleware';

describe('Rate limiting', () => {
  it('allows requests under the limit, then returns 429 with the standard envelope', async () => {
    const app = express();
    app.use(createRateLimiter({ limit: 1, windowMs: 60_000, validate: false }));
    app.get('/', (_req, res) => {
      res.json({ success: true });
    });

    const first = await request(app).get('/');
    expect(first.status).toBe(200);

    const second = await request(app).get('/');
    expect(second.status).toBe(429);
    expect(second.body.success).toBe(false);
    expect(second.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
