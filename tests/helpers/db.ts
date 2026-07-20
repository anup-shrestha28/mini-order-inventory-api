import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replset: MongoMemoryReplSet | undefined;

/**
 * Spin up an in-memory MongoDB **replica set** and connect Mongoose to it.
 * A replica set (not a standalone) is used so multi-document transactions —
 * exercised by the order-creation flow — work in tests without any external DB.
 */
export async function connect(): Promise<void> {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri());
}

/** Remove all documents between tests for isolation. */
export async function clearDatabase(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** Tear down the connection and the in-memory server. */
export async function close(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (replset) await replset.stop();
}
