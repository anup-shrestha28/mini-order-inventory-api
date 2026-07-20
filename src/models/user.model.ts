import { Schema, model, Model, HydratedDocument } from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env';

export type UserRole = 'admin' | 'customer';

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

type UserModelType = Model<IUser, Record<string, never>, IUserMethods>;

const userSchema = new Schema<IUser, UserModelType, IUserMethods>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // Never returned by default queries; must be explicitly selected (e.g. at login).
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'customer'],
        message: 'Role must be either admin or customer',
      },
      default: 'customer',
    },
  },
  { timestamps: true }
);

// Hash the password at the model level whenever it is set/changed — so hashing
// can never be forgotten by a caller, and plaintext never reaches the database.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function comparePassword(
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Clean API representation: expose `id`, never leak `password` or `__v`.
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete (ret as { password?: string }).password;
    delete (ret as { _id?: unknown })._id;
    return ret;
  },
});

export const User = model<IUser, UserModelType>('User', userSchema);
