import type { Server } from 'http';
import app from './app';
import env from './config/env';
import logger from './utils/logger';
import { connectDB, disconnectDB } from './config/db';

let server: Server | undefined;

async function start(): Promise<void> {
  // Start listening first so /health is reachable while the DB connection
  // (and, under Docker, the Mongo replica-set election) settles.
  server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  try {
    await connectDB();
  } catch (err) {
    logger.error({ err }, 'Could not connect to MongoDB after retries — shutting down');
    await shutdown(1);
  }
}

async function shutdown(code = 0): Promise<void> {
  logger.info('Shutting down gracefully...');
  try {
    const s = server;
    if (s) await new Promise<void>((resolve) => s.close(() => resolve()));
    await disconnectDB();
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
  } finally {
    process.exit(code);
  }
}

process.on('SIGINT', () => {
  void shutdown(0);
});
process.on('SIGTERM', () => {
  void shutdown(0);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

void start();

export { start, shutdown };
