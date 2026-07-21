# Deployment, Scaling & Decomposition Notes

> These are the design/operations notes requested by the assessment's stretch goals
> (deployment approach; how the service would scale and decompose). No live URL is
> included here — an actual deployment requires a cloud account — but the service is
> deployment-ready (stateless container, env-based config, health check).

## Deploying to AWS

The app is a **stateless container**, so it deploys to any container platform. Recommended on AWS:

- **Compute — ECS on Fargate** (serverless containers): build the image, push to **ECR**, run it as an ECS service behind an **Application Load Balancer**. Fargate avoids managing EC2 hosts. (Elastic Beanstalk multi-container or plain EC2 + Docker are simpler alternatives.)
- **Database — MongoDB Atlas** (managed, and already a replica set, so the order transactions work). Point `MONGO_URI` at the Atlas SRV string. Avoid self-hosting Mongo in production.
- **Cache — ElastiCache for Redis**: set `REDIS_URL`. Caching degrades gracefully if it's absent.
- **Configuration & secrets** — inject `MONGO_URI`, `JWT_SECRET`, etc. via ECS task definition secrets backed by **AWS Secrets Manager / SSM Parameter Store**. Never bake secrets into the image (the repo already keeps all config in env vars).
- **Health checks** — point the ALB target group and ECS health check at `GET /health`.
- **Scaling** — ECS service auto-scaling on CPU / request count; the app is horizontally scalable because it holds no local state (JWT is stateless; cache/state live in Redis/Mongo).
- **CI/CD** — the included GitHub Actions workflow runs lint + tests on every push; extend it to build and push the image to ECR and trigger an ECS rolling deploy.

## Scaling the product listing to millions of documents

- **Indexes** (already present): `category` and `createdAt` back the current filter/sort. Add compound indexes matching real query shapes as they emerge.
- **Pagination**: `skip/limit` is fine for early pages but degrades on deep offsets. Switch to **cursor / range-based pagination** (`createdAt < lastSeen`) for large catalogs.
- **Caching** (implemented): Redis caches the read-heavy product list with short TTL + version-based invalidation on writes. Fronts the DB for hot queries.
- **Projection**: return only needed fields to cut payload/IO.
- **Search**: for full-text/faceted search at scale, use **MongoDB Atlas Search** or a dedicated search service (Elasticsearch/OpenSearch) rather than regex scans.
- **Read replicas**: route list/read traffic to secondaries with an appropriate read preference.

## What happens when two requests hit `findOneAndUpdate` on the same document

MongoDB applies single-document updates atomically and serializes them at the document level. With the conditional filter `{ stock: { $gte: qty } }`, the first writer decrements; the second re-evaluates the (now-updated) document and, if it would oversell, simply doesn't match and returns `null`. Inside a transaction, a concurrent write raises a transient **write-conflict**, which the driver's `withTransaction` **retries** automatically — so it converges to the correct result (verified by the race-condition test: 20 concurrent orders vs. stock 10 → exactly 10 succeed, stock never goes negative).

## Microservice decomposition

If this needed to become multiple services, split by **bounded context**:

- **Identity service** — users, auth, JWT issuance.
- **Catalog service** — products (read-heavy; cache/search live here).
- **Orders & Inventory service** — orders **and** stock. Keeping stock ownership together with order placement preserves the atomic decrement guarantee within a single database.

Cross-service consistency (e.g., an order that spans catalog + payment) should use a **saga with an outbox/events** pattern rather than distributed transactions: emit an `order.placed` event, compensate on failure. Each service owns its own database (share-nothing); communicate via REST/gRPC for queries and async events for state changes. A second service such as **payments** would be **fully separate** (its own DB), integrated via events — not sharing the orders DB.

## Running on Kubernetes

- **Deployment** running the container image + **HorizontalPodAutoscaler** (scale on CPU/RPS).
- **Service** + **Ingress** for routing/TLS.
- **ConfigMap** for non-secret config; **Secret** for `MONGO_URI`, `JWT_SECRET`, `REDIS_URL`.
- **Liveness & readiness probes** → `/health`.
- **MongoDB** via Atlas or the MongoDB Community/Enterprise **Operator** (StatefulSet); **Redis** via a managed offering or the Redis operator.
- Rolling updates for zero-downtime deploys; resource requests/limits per pod.
