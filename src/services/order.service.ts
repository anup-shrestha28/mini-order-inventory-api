import mongoose, { FilterQuery, Types } from 'mongoose';
import { Product } from '../models/product.model';
import { Order, IOrder, IOrderItem, OrderDocument } from '../models/order.model';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta } from '../utils/ApiResponse';
import { invalidateProductListCache } from './product.service';
import type { UserRole } from '../models/user.model';
import type { OrderItemInput, ListOrdersQuery } from '../validators/order.validator';

interface CurrentUser {
  id: string;
  role: UserRole;
}

/**
 * Place an order.
 *
 * Concurrency safety (the core requirement — never oversell, even under
 * simultaneous requests):
 *
 *  1. **Conditional atomic update as the oversell guard.** Each product's stock
 *     is decremented with `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })`.
 *     The match + decrement is a single atomic document operation, so a racing
 *     request that would drive stock negative simply doesn't match (returns null)
 *     and never decrements.
 *
 *  2. **Multi-document transaction for all-or-nothing.** All decrements + the order
 *     insert run in one transaction. If any line fails (insufficient stock / missing
 *     product), we throw, the transaction aborts, and every earlier decrement in this
 *     order is rolled back automatically — no partial orders.
 *
 * Duplicate line items referencing the same product are aggregated first, so the
 * stock check reflects the true requested total.
 */
export async function createOrder(
  userId: string,
  rawItems: OrderItemInput[]
): Promise<OrderDocument> {
  // Aggregate duplicate line items (same product listed more than once).
  const quantityByProduct = new Map<string, number>();
  for (const item of rawItems) {
    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) ?? 0) + item.quantity
    );
  }

  const session = await mongoose.startSession();
  let order: OrderDocument | undefined;

  try {
    await session.withTransaction(async () => {
      const items: IOrderItem[] = [];
      let totalAmount = 0;

      for (const [productId, quantity] of quantityByProduct) {
        // Atomic guard: only matches (and decrements) if enough stock exists.
        const updated = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );

        if (!updated) {
          // No match: either the product doesn't exist, or stock is insufficient.
          const exists = await Product.exists({ _id: productId }).session(session);
          if (!exists) {
            throw ApiError.notFound(`Product not found: ${productId}`, {
              code: 'PRODUCT_NOT_FOUND',
            });
          }
          throw ApiError.conflict(`Insufficient stock for product ${productId}`, {
            code: 'INSUFFICIENT_STOCK',
          });
        }

        items.push({
          product: updated._id as Types.ObjectId,
          name: updated.name,
          priceAtPurchase: updated.price,
          quantity,
        });
        totalAmount += updated.price * quantity;
      }

      // Create the order inside the same transaction (array form is required
      // when passing a session to Model.create).
      const created = await Order.create([{ user: userId, items, totalAmount, status: 'pending' }], {
        session,
      });
      order = created[0];
    });
  } finally {
    await session.endSession();
  }

  if (!order) throw ApiError.internal('Order could not be created');
  // Order placement changed stock → invalidate the product-list cache so reads are immediately fresh.
  await invalidateProductListCache();
  return order;
}

export async function listOrders(query: ListOrdersQuery, currentUser: CurrentUser) {
  const { page, limit, status, from, to, sort } = query;

  const filter: FilterQuery<IOrder> = {};
  // Customers see only their own orders; admins see everyone's.
  if (currentUser.role !== 'admin') filter.user = new Types.ObjectId(currentUser.id);
  if (status) filter.status = status;
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = from;
    if (to) createdAt.$lte = to;
    filter.createdAt = createdAt as FilterQuery<IOrder>['createdAt'];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'name email'),
    Order.countDocuments(filter),
  ]);

  return { data: items, meta: buildPaginationMeta({ page, limit, total }) };
}

export async function getOrderById(id: string, currentUser: CurrentUser): Promise<OrderDocument> {
  // Scoping by user for customers enforces "view only their own orders" and
  // avoids leaking the existence of other customers' orders.
  const filter: FilterQuery<IOrder> =
    currentUser.role === 'admin' ? { _id: id } : { _id: id, user: new Types.ObjectId(currentUser.id) };

  const order = await Order.findOne(filter).populate('user', 'name email');
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

/**
 * Cancel an order and restore its stock atomically (transaction). Customers can
 * cancel only their own orders; admins can cancel any.
 */
export async function cancelOrder(id: string, currentUser: CurrentUser): Promise<OrderDocument> {
  const session = await mongoose.startSession();
  let order: OrderDocument | undefined;

  try {
    await session.withTransaction(async () => {
      const filter: FilterQuery<IOrder> =
        currentUser.role === 'admin'
          ? { _id: id }
          : { _id: id, user: new Types.ObjectId(currentUser.id) };

      const found = await Order.findOne(filter).session(session);
      if (!found) throw ApiError.notFound('Order not found');
      if (found.status === 'cancelled') {
        throw ApiError.conflict('Order is already cancelled', { code: 'ALREADY_CANCELLED' });
      }

      // Restore stock for each line. If a product was since deleted, the update
      // is a no-op — cancellation still succeeds.
      for (const item of found.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      found.status = 'cancelled';
      await found.save({ session });
      order = found;
    });
  } finally {
    await session.endSession();
  }

  if (!order) throw ApiError.internal('Order could not be cancelled');
  // Cancellation restored stock → invalidate the product-list cache.
  await invalidateProductListCache();
  return order;
}
