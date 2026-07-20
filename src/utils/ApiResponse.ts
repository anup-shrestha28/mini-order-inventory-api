import { Response } from 'express';

/**
 * Consistent success envelope for the whole API:
 *   { "success": true, "data": <payload>, "meta"?: <pagination/etc> }
 *
 * The error counterpart is produced by the central error middleware:
 *   { "success": false, "error": { "code", "message", "details"? } }
 */
export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  data: T,
  meta?: unknown
): Response {
  const body: { success: true; data: T; meta?: unknown } = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

export interface PaginationInput {
  page: number;
  limit: number;
  total: number;
}

/** Build a standard pagination meta object. */
export function buildPaginationMeta({ page, limit, total }: PaginationInput) {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}
