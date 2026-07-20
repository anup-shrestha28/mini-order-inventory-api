import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import * as orderService from '../services/order.service';
import { listOrdersQuerySchema } from '../validators/order.validator';

// All order routes run after `authenticate`, so req.user is guaranteed present.
function currentUser(req: Request) {
  return { id: req.user!.id, role: req.user!.role };
}

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.user!.id, req.body.items);
  sendSuccess(res, 201, { order });
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = listOrdersQuerySchema.parse(req.query);
  const { data, meta } = await orderService.listOrders(query, currentUser(req));
  sendSuccess(res, 200, data, meta);
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(req.params.id, currentUser(req));
  sendSuccess(res, 200, { order });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.cancelOrder(req.params.id, currentUser(req));
  sendSuccess(res, 200, { order });
});
