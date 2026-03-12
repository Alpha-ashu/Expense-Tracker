import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500
    ? 'Something went wrong. Please try again later.'
    : (err.message || 'An error occurred');

  // Always log the real error for developers
  logger.error('Unhandled error', {
    statusCode,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    code: statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
  });
};
