import { User, UserDocument } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { signToken } from '../utils/jwt';
import type { SignupInput, LoginInput } from '../validators/auth.validator';

interface AuthResult {
  user: UserDocument;
  token: string;
}

/** Register a new customer account and issue an access token. */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('Email is already registered', { code: 'EMAIL_TAKEN' });
  }

  // Role is forced to 'customer' here — never taken from client input.
  const user = await User.create({ ...input, role: 'customer' });
  const token = signToken({ sub: user.id, role: user.role });
  return { user, token };
}

/** Authenticate with email + password and issue an access token. */
export async function login(input: LoginInput): Promise<AuthResult> {
  // Password is `select: false` on the schema, so request it explicitly.
  const user = await User.findOne({ email: input.email }).select('+password');
  // Same generic error whether the email is unknown or the password is wrong,
  // so we don't reveal which emails are registered.
  if (!user || !(await user.comparePassword(input.password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken({ sub: user.id, role: user.role });
  return { user, token };
}
