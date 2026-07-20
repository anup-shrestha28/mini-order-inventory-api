import pino from 'pino';
import env from '../config/env';

const isDev = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';

const logger = pino({
  level: isTest
    ? 'silent'
    : process.env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Pretty, human-readable logs in development only; structured JSON otherwise.
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      }
    : undefined,
});

export default logger;
