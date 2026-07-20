import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';

// Guard against unknown query operators reaching the driver from user input.
mongoose.set('strictQuery', true);

interface ConnectOptions {
  retries?: number;
  delayMs?: number;
}

/**
 * Connect to MongoDB with a bounded retry loop. Important under Docker Compose:
 * the app container may start a moment before the Mongo replica set finishes
 * electing a primary, so we retry instead of crashing on the first failure.
 */
export async function connectDB(
  uri: string = env.MONGO_URI,
  { retries = 10, delayMs = 3000 }: ConnectOptions = {}
): Promise<mongoose.Connection> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info('✅ Connected to MongoDB');
      return mongoose.connection;
    } catch (err) {
      logger.warn(
        `MongoDB connection attempt ${attempt}/${retries} failed: ${(err as Error).message}`
      );
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable, but satisfies control-flow analysis.
  throw new Error('Failed to connect to MongoDB');
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
