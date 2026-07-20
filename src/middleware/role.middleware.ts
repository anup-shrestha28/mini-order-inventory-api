import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import type { UserRole } from '../models/user.model';

/**
 * Role-based access control, enforced in middleware (not in controllers).
 * Must run after `authenticate`. Usage: `router.post('/', authenticate, authorize('admin'), handler)`.
 */
export const authorize =
  (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(ApiError.forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
