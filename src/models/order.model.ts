import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

export interface IOrderItem {
  product: Types.ObjectId;
  name: string; // snapshot — order history survives product renames/deletes
  priceAtPurchase: number; // snapshot — history unaffected by later price changes
  quantity: number;
}

export interface IOrder {
  user: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<IOrder>;

type OrderModelType = Model<IOrder>;

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    priceAtPurchase: { type: Number, required: true, min: 0 },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder, OrderModelType>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: 'An order must contain at least one item',
      },
    },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Indexes for the real access patterns:
// - { user, createdAt }: a customer's own orders, newest first (paginated)
// - status: filter by status
// - createdAt: admin listing / date-range filter, newest first
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete (ret as { _id?: unknown })._id;
    return ret;
  },
});

export const Order = model<IOrder, OrderModelType>('Order', orderSchema);
