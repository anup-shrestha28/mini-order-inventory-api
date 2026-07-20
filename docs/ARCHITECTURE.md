# Architecture

This document explains how the Mini Order & Inventory API is structured, how a request flows through it, how the concurrency-safe order flow works, and how the data is modeled. Diagrams are written in [Mermaid](https://mermaid.js.org/) so they render directly on GitHub and stay in version control.

> These diagrams reflect the **target design**. Components are implemented incrementally per the phase plan in the project README (see *Requirement Coverage*).

---

## 1. System & component overview

The whole system runs as two containers via Docker Compose: the Express API and a MongoDB replica set. Inside the API, responsibilities are split into clean layers (routes → middleware → controllers → services → models).

```mermaid
flowchart TD
    client(["Client / API consumer"])

    subgraph compose["Docker Compose"]
        direction TB
        subgraph appc["API container — Node.js + Express (TypeScript)"]
            direction TB
            routes["Routes<br/>/api/v1/auth · /products · /orders"]
            mw["Middleware<br/>helmet · cors · mongo-sanitize<br/>JWT auth · role guard · Zod validation<br/>central error handler"]
            controllers["Controllers<br/>HTTP request / response"]
            services["Services<br/>business logic +<br/>atomic order & stock core"]
            models["Mongoose Models<br/>schema validation + indexes"]
        end
        mongo[("MongoDB<br/>replica set rs0<br/>volume: mongo_data")]
    end

    client -->|"HTTP / JSON"| routes
    routes --> mw
    mw --> controllers
    controllers --> services
    services --> models
    models -->|"Mongoose driver"| mongo
    mongo -.->|"multi-document transactions (sessions)"| services
```

**Why layered?** Each layer has one job and is independently testable. The business logic — including the atomic stock/order core — lives in **services**, never in route handlers. This maps directly to the *Code quality & structure* evaluation criterion.

---

## 2. Request lifecycle

Every request passes through the same middleware pipeline before reaching business logic, and every error converges on one central handler that emits the API's consistent error envelope.

```mermaid
flowchart LR
    A["Incoming request"] --> B["Security middleware<br/>helmet · cors · mongo-sanitize"]
    B --> C{"Protected route?"}
    C -->|"yes"| D["JWT auth middleware<br/>verify token -> req.user"]
    C -->|"no"| E["Zod validation"]
    D --> F{"Role allowed?"}
    F -->|"no"| X["403 Forbidden"]
    F -->|"yes"| E
    E -->|"invalid"| Y["400 Validation error"]
    E -->|"valid"| G["Controller -> Service -> Model"]
    G --> H["Success envelope<br/>{ success: true, data, meta? }"]
    X --> Z["Central error handler<br/>{ success: false, error }"]
    Y --> Z
    G -.->|"throws ApiError"| Z
```

---

## 3. Order creation — the concurrency-safe core

This is the heart of the assessment. An order can contain several products; the system must never oversell stock even under simultaneous requests. We use a **conditional atomic update** (the oversell guard) executed **inside a multi-document transaction** (all-or-nothing across the order).

```mermaid
sequenceDiagram
    actor Cust as Customer
    participant API as Controller (Express)
    participant Svc as Order Service
    participant DB as MongoDB (rs0)

    Cust->>API: POST /api/v1/orders { items: [...] }
    API->>API: JWT auth + role + Zod validation
    API->>Svc: createOrder(userId, items)
    Svc->>Svc: aggregate duplicate line items (same product)
    Svc->>DB: startSession + startTransaction

    loop for each product line
        Svc->>DB: findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
        alt enough stock (document matched)
            DB-->>Svc: updated product
        else insufficient / missing (null)
            Svc->>DB: abortTransaction (rolls back earlier decrements)
            Svc-->>API: error (409 insufficient / 404 not found)
            API-->>Cust: error response
        end
    end

    Svc->>DB: insert Order (snapshot priceAtPurchase)
    Svc->>DB: commitTransaction
    DB-->>Svc: ok
    Svc-->>API: created order
    API-->>Cust: 201 Created
```

**Key points**

- The filter `{ stock: { $gte: qty } }` and the decrement `{ $inc: { stock: -qty } }` are **one atomic document operation** — the oversell guard. A losing racer simply doesn't match and returns `null`; it never drives stock negative.
- Wrapping all decrements in a **transaction** makes a multi-product order atomic: if any line fails, prior decrements roll back automatically (no hand-rolled compensation).
- **Order cancellation** reverses this: it restores stock with `{ $inc: { stock: +qty } }` inside a transaction and marks the order `cancelled`.

See the README's *Concurrency & Data-Modeling Design* section for the trade-off discussion (transaction vs. atomic-update-only).

---

## 4. Data model

Three collections. Order line items are **embedded** in the order document (a Mongoose subdocument array), not a separate collection — an order is a natural aggregate and is almost always read whole.

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : "contains (embedded)"
    PRODUCT ||--o{ ORDER_ITEM : "referenced by"

    USER {
        ObjectId _id PK
        string name
        string email UK "unique index"
        string password "bcrypt hash (never returned)"
        string role "admin | customer"
        date createdAt
        date updatedAt
    }
    PRODUCT {
        ObjectId _id PK
        string name
        number price
        number stock
        string category "index (filtering)"
        date createdAt
        date updatedAt
    }
    ORDER {
        ObjectId _id PK
        ObjectId user FK "index (own-order lookups)"
        array items "embedded ORDER_ITEM[]"
        number totalAmount
        string status "pending | confirmed | cancelled (index)"
        date createdAt "index (pagination/sort)"
        date updatedAt
    }
    ORDER_ITEM {
        ObjectId product FK "reference -> PRODUCT"
        number quantity
        number priceAtPurchase "snapshot at order time"
    }
```

**Design choices**

- **Price snapshot** (`priceAtPurchase`): order history stays correct even when a product's price later changes.
- **Indexes**: unique `email`; `category` for product filtering; `user`, `status`, `createdAt` on orders for own-order lookups, filtering, and paginated sorting.
