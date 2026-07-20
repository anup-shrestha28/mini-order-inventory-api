const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

export interface ApiErrorOptions {
  code?: string;
  details?: unknown;
}

/**
 * Operational error carrying an HTTP status, a stable machine-readable `code`,
 * and optional structured `details`. Thrown anywhere, caught by the central
 * error handler, and rendered into the API's consistent error envelope.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, { code, details }: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || CODE_BY_STATUS[statusCode] || 'ERROR';
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, opts?: ApiErrorOptions) {
    return new ApiError(400, message, opts);
  }
  static unauthorized(message = 'Unauthorized', opts?: ApiErrorOptions) {
    return new ApiError(401, message, opts);
  }
  static forbidden(message = 'Forbidden', opts?: ApiErrorOptions) {
    return new ApiError(403, message, opts);
  }
  static notFound(message = 'Resource not found', opts?: ApiErrorOptions) {
    return new ApiError(404, message, opts);
  }
  static conflict(message: string, opts?: ApiErrorOptions) {
    return new ApiError(409, message, opts);
  }
  static unprocessable(message: string, opts?: ApiErrorOptions) {
    return new ApiError(422, message, opts);
  }
  static tooManyRequests(message = 'Too many requests', opts?: ApiErrorOptions) {
    return new ApiError(429, message, opts);
  }
  static internal(message = 'Internal server error', opts?: ApiErrorOptions) {
    return new ApiError(500, message, opts);
  }
}

export default ApiError;
