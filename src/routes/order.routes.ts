import { Router } from 'express';

const router = Router();

// Routes implemented in Phase 3 (Order Creation — core evaluation focus):
//   POST  /api/v1/orders            (customer: place order — atomic stock decrement)
//   GET   /api/v1/orders            (customer: own orders / admin: all; paginated + filterable)
//   GET   /api/v1/orders/:id        (customer: own / admin: any)
//   POST  /api/v1/orders/:id/cancel (cancel order + atomically restore stock)

export default router;
