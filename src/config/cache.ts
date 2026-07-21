import Redis from 'ioredis';
import env from './env';
import logger from '../utils/logger';

/**
 * Optional Redis cache with graceful degradation. If REDIS_URL is unset, or
 * Redis is unreachable, every operation becomes a safe no-op and the app runs
 * straight against MongoDB — caching never becomes a hard dependency.
 */
let client: Redis | null = null;
let ready = false;

if (env.REDIS_URL) {
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    // Give up reconnecting after a few tries so a missing Redis doesn't spam
    // logs; caching simply stays disabled.
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
  client.on('ready', () => {
    ready = true;
    logger.info('✅ Connected to Redis — product-list caching enabled');
  });
  client.on('error', (err) => {
    if (ready) logger.warn(`Redis error: ${err.message}`);
    ready = false;
  });
  client.on('end', () => {
    ready = false;
  });
}

export const cache = {
  isEnabled(): boolean {
    return ready && client !== null;
  },

  async get(key: string): Promise<string | null> {
    if (!this.isEnabled() || !client) return null;
    try {
      return await client.get(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled() || !client) return;
    try {
      await client.set(key, value, 'EX', ttlSeconds);
    } catch {
      /* ignore cache write failures */
    }
  },

  /** Current cache generation for a namespace (defaults to '0' when disabled). */
  async getVersion(key: string): Promise<string> {
    if (!this.isEnabled() || !client) return '0';
    try {
      return (await client.get(key)) ?? '0';
    } catch {
      return '0';
    }
  },

  /** Bump a namespace's generation, invalidating all keys built from the old one. */
  async bumpVersion(key: string): Promise<void> {
    if (!this.isEnabled() || !client) return;
    try {
      await client.incr(key);
    } catch {
      /* ignore */
    }
  },

  async disconnect(): Promise<void> {
    if (!client) return;
    try {
      await client.quit();
    } catch {
      /* ignore */
    }
  },
};
