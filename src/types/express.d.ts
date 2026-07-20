import type { UserDocument } from '../models/user.model';

// Augment Express's Request so `req.user` is available (and typed) after the
// authenticate middleware runs.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}

export {};
