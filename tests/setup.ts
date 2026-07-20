// Global Jest setup. Runs before each test file.
// Provides safe defaults so config/env validation passes; individual test
// suites spin up an in-memory MongoDB replica set and connect to *that* URI.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_value';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4'; // fast hashing in tests
// Placeholder; real suites override by connecting mongoose to the in-memory server.
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/moi_test';

jest.setTimeout(60000);
