import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import orderRoutes from './order.routes';

const router = Router();

// API root — quick metadata / sanity endpoint.
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'Mini Order & Inventory API', version: 'v1' },
  });
});

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);

export default router;
