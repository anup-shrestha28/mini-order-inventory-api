import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import * as productService from '../services/product.service';
import { listProductsQuerySchema } from '../validators/product.validator';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  // Query params validated/coerced here (ZodError -> 400 via the error handler).
  const query = listProductsQuerySchema.parse(req.query);
  const { data, meta } = await productService.listProducts(query);
  sendSuccess(res, 200, data, meta);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  sendSuccess(res, 200, { product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body);
  sendSuccess(res, 201, { product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  sendSuccess(res, 200, { product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.params.id);
  sendSuccess(res, 200, { message: 'Product deleted', id: req.params.id });
});
