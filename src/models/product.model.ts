import { Schema, model, Model, HydratedDocument } from 'mongoose';

export interface IProduct {
  name: string;
  price: number;
  stock: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<IProduct>;

type ProductModelType = Model<IProduct>;

const productSchema = new Schema<IProduct, ProductModelType>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [200, 'Name must be at most 200 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be a whole number',
      },
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      lowercase: true, // normalized so filtering by category is consistent
    },
  },
  { timestamps: true }
);

// Indexes chosen for the actual access patterns:
// - category: equality filter on the product list
// - createdAt: default sort / pagination ordering
productSchema.index({ category: 1 });
productSchema.index({ createdAt: -1 });

productSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete (ret as { _id?: unknown })._id;
    return ret;
  },
});

export const Product = model<IProduct, ProductModelType>('Product', productSchema);
