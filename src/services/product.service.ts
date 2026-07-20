import { FilterQuery } from 'mongoose';
import { Product, IProduct, ProductDocument } from '../models/product.model';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta } from '../utils/ApiResponse';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from '../validators/product.validator';

export async function createProduct(input: CreateProductInput): Promise<ProductDocument> {
  return Product.create(input);
}

export async function getProductById(id: string): Promise<ProductDocument> {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

export async function listProducts(query: ListProductsQuery) {
  const { page, limit, category, minPrice, maxPrice, sort } = query;

  // Build the filter only from validated primitives — never spread raw user
  // input into the query, which keeps NoSQL-injection operators out.
  const filter: FilterQuery<IProduct> = {};
  if (category) filter.category = category;
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) priceFilter.$gte = minPrice;
    if (maxPrice !== undefined) priceFilter.$lte = maxPrice;
    filter.price = priceFilter as FilterQuery<IProduct>['price'];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  return { data: items, meta: buildPaginationMeta({ page, limit, total }) };
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<ProductDocument> {
  // runValidators ensures model-level validation also applies on updates.
  const product = await Product.findByIdAndUpdate(id, input, {
    new: true,
    runValidators: true,
  });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

export async function deleteProduct(id: string): Promise<ProductDocument> {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}
