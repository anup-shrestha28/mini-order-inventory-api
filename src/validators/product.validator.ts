import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  price: z.number({ invalid_type_error: 'Price must be a number' }).positive('Price must be greater than 0'),
  stock: z
    .number({ invalid_type_error: 'Stock must be a number' })
    .int('Stock must be a whole number')
    .nonnegative('Stock cannot be negative'),
  category: z.string().trim().toLowerCase().min(1, 'Category is required'),
});

// All fields optional for a partial update, but at least one must be supplied.
export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

// Query params arrive as strings, so numbers are coerced. Provides pagination
// (page/limit) plus filters (category, price range) and a bounded sort.
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().trim().toLowerCase().min(1).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(['createdAt', '-createdAt', 'price', '-price']).default('-createdAt'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
