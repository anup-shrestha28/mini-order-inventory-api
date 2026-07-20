import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import * as authService from '../services/auth.service';

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { user, token } = await authService.signup(req.body);
  sendSuccess(res, 201, { user, token });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, token } = await authService.login(req.body);
  sendSuccess(res, 200, { user, token });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 200, { user: req.user });
});
