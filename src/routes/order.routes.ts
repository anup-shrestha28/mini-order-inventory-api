import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema } from '../validators/order.validator';

const router = Router();

// Every order route requires authentication.
router.use(authenticate);

// Place an order (any authenticated user; the order is owned by that user).
router.post('/', validate(createOrderSchema), orderController.createOrder);

// List orders — customers see only their own, admins see all (paginated + filterable).
router.get('/', orderController.listOrders);

// A single order — customers scoped to their own.
router.get('/:id', orderController.getOrder);

// Cancel an order and restore stock atomically.
router.post('/:id/cancel', orderController.cancelOrder);

export default router;
