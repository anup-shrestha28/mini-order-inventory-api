import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import env from './config/env';
import logger from './utils/logger';
import routes from './routes';
import openapiSpec from './docs/openapi';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';

const app = express();

// --- API documentation (Swagger UI) ---
// Mounted before the global strict CSP so Swagger UI's inline assets can load.
// The docs are a read-only convenience, so a relaxed CSP here is acceptable.
app.use(
  '/api/docs',
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { customSiteTitle: 'Mini Order & Inventory API — Docs' })
);
app.get('/api/docs.json', (_req, res) => {
  res.json(openapiSpec);
});

// --- Security & parsing middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
// Strip keys containing `$`/`.` to blunt NoSQL-injection attempts.
app.use(mongoSanitize());

// --- Request logging (skipped in tests to keep output clean) ---
if (env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }));
}

// --- Health check (used by Docker healthcheck & load balancers) ---
app.get('/health', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      db: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    },
  });
});

// --- API routes ---
app.use('/api/v1', routes);

// --- 404 + centralized error handling (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
