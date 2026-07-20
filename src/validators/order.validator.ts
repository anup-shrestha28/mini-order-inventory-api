import { z } from 'zod';

// 24-char hex — a valid MongoDB ObjectId. Rejects malformed ids at the edge (400).
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product id');

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: objectId,
        quantity: z
          .number({ invalid_type_error: 'Quantity must be a number' })
          .int('Quantity must be a whole number')
          .positive('Quantity must be at least 1'),
      })
    )
    .min(1, 'An order must contain at least one item'),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['createdAt', '-createdAt', 'totalAmount', '-totalAmount']).default('-createdAt'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = CreateOrderInput['items'][number];
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
