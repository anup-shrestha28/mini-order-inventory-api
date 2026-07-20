import jwt, { SignOptions } from 'jsonwebtoken';
import env from '../config/env';
import type { UserRole } from '../models/user.model';

export interface AppJwtPayload {
  sub: string; // user id
  role: UserRole;
}

/** Sign a short-lived access token embedding the user id and role. */
export function signToken(payload: AppJwtPayload): string {
  const options: SignOptions = {
    // Cast accommodates @types/jsonwebtoken's strict `expiresIn` string literal type.
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/** Verify a token and return its decoded payload. Throws if invalid/expired. */
export function verifyToken(token: string): AppJwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as AppJwtPayload;
}
