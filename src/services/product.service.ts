import { FilterQuery } from 'mongoose';
import { Product, IProduct, ProductDocument } from '../models/product.model';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta } from '../utils/ApiResponse';
import env from '../config/env';
import { cache } from '../config/cache';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from '../validators/product.validator';

// Product-list cache: keys are versioned; any product write bumps the version,
// which instantly invalidates every cached list page (old keys expire via TTL).
const CACHE_VERSION_KEY = 'products:cache:version';

export async function createProduct(input: CreateProductInput): Promise<ProductDocument> {
  const product = await Product.create(input);
  await cache.bumpVersion(CACHE_VERSION_KEY);
  return product;
}

export async function getProductById(id: string): Promise<ProductDocument> {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

export async function listProducts(query: ListProductsQuery) {
  const { page, limit, category, minPrice, maxPrice, sort } = query;

  // Serve from cache when available (read-heavy endpoint).
  const version = await cache.getVersion(CACHE_VERSION_KEY);
  const cacheKey = `products:list:v${version}:${JSON.stringify(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as {
      data: ProductDocument[];
      meta: ReturnType<typeof buildPaginationMeta>;
    };
  }

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

  const result = { data: items, meta: buildPaginationMeta({ page, limit, total }) };
  await cache.set(cacheKey, JSON.stringify(result), env.CACHE_TTL_SECONDS);
  return result;
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
  await cache.bumpVersion(CACHE_VERSION_KEY);
  return product;
}

export async function deleteProduct(id: string): Promise<ProductDocument> {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw ApiError.notFound('Product not found');
  await cache.bumpVersion(CACHE_VERSION_KEY);
  return product;
}
