# syntax=docker/dockerfile:1

# ---- Builder: install all deps and compile TypeScript -> dist ----
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ---- Production dependencies only ----
FROM node:20-slim AS proddeps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Runtime: slim image with compiled JS + prod deps ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as an unprivileged user.
RUN groupadd --system nodeapp && useradd --system --gid nodeapp nodeapp

COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

USER nodeapp
EXPOSE 3000

# Container-level health check hitting the app's /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]
