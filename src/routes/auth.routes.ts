import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { signupSchema, loginSchema } from '../validators/auth.validator';

const router = Router();

// POST /api/v1/auth/signup — register a new customer, returns user + JWT
router.post('/signup', validate(signupSchema), authController.signup);

// POST /api/v1/auth/login — authenticate, returns user + JWT
router.post('/login', validate(loginSchema), authController.login);

// GET /api/v1/auth/me — current authenticated user
router.get('/me', authenticate, authController.me);

export default router;
