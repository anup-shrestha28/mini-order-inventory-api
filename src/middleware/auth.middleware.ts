import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';

/**
 * Authenticates a request via a `Bearer <token>` Authorization header.
 * Verifies the JWT, then loads the user from the database (so deleted users
 * and stale roles are rejected) and attaches it to `req.user`.
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required: provide a Bearer token');
    }

    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('The user for this token no longer exists');
    }

    req.user = user;
    next();
  }
);
