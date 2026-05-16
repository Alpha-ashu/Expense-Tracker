/**
 * AppError  typed error class for all application-level errors.
 * Controllers should throw AppError instead of building inline res.json() error responses.
 * The central errorHandler middleware in middleware/error.ts will consume and format these.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  //  Common factory helpers 

  static badRequest(message: string, code = 'BAD_REQUEST'): AppError {
    return new AppError(400, code, message);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(resource = 'Resource', code = 'NOT_FOUND'): AppError {
    return new AppError(404, code, `${resource} not found`);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(409, code, message);
  }

  static tooManyRequests(message = 'Too many requests. Please slow down.', code = 'RATE_LIMIT_EXCEEDED'): AppError {
    return new AppError(429, code, message);
  }

  static internal(message = 'Something went wrong. Please try again later.', code = 'INTERNAL_ERROR'): AppError {
    return new AppError(500, code, message, false);
  }
}

/**
 * Prisma error code  AppError mapper.
 * Call this in the errorHandler to intercept Prisma-specific codes centrally.
 */
export function fromPrismaError(error: any): AppError | null {
  if (!error || error.name !== 'PrismaClientKnownRequestError') {
    return null;
  }

  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return AppError.conflict(
        'This record already exists. Please use different values.',
        'DUPLICATE_ENTRY',
      );
    case 'P2025':
      // Record not found
      return AppError.notFound('Record');
    case 'P2003':
      // Foreign key constraint
      return AppError.badRequest('Referenced record does not exist.', 'FOREIGN_KEY_VIOLATION');
    case 'P2016':
      // Query interpretation error
      return AppError.badRequest('Invalid query parameters.', 'INVALID_QUERY');
    default:
      return null;
  }
}

/**
 * Check whether an error is a database connectivity error.
 */
export function isDatabaseConnectivityError(error: any): boolean {
  if (!error) return false;
  const msg: string = error?.message ?? '';
  return (
    error.code === 'P1001' ||
    error.code === 'P1002' ||
    msg.includes("Can't reach database") ||
    msg.includes('Error validating datasource') ||
    msg.includes('Connection refused')
  );
}

