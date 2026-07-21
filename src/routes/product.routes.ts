import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';

const router = Router();

// Public catalog browsing (paginated + filterable).
router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);

// Admin-only writes — role enforced in middleware, not in the controller.
router.post('/', authenticate, authorize('admin'), validate(createProductSchema), productController.createProduct);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(updateProductSchema),
  productController.updateProduct
);
router.delete('/:id', authenticate, authorize('admin'), productController.deleteProduct);

export default router;
