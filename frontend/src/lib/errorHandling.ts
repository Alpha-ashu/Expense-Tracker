/**
 * Error Handling Utilities
 * Centralized error handling and recovery strategies
 */

import { toast } from 'sonner';

// ==================== Error Types ====================

export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  AUTHENTICATION = 'AUTH_ERROR',
  AUTHORIZATION = 'PERMISSION_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  recoverable: boolean;
  timestamp: Date;
}

// ==================== Error Factory ====================

export class ErrorFactory {
  static create(
    type: ErrorType,
    message: string,
    code?: string,
    details?: any
  ): AppError {
    return {
      type,
      message,
      code,
      details,
      recoverable: ErrorFactory.isRecoverable(type),
      timestamp: new Date(),
    };
  }

  static fromHTTPStatus(status: number, message?: string): AppError {
    switch (status) {
      case 400:
        return ErrorFactory.create(
          ErrorType.VALIDATION,
          message || 'Invalid request data',
          'BAD_REQUEST'
        );
      case 401:
        return ErrorFactory.create(
          ErrorType.AUTHENTICATION,
          message || 'Authentication required',
          'UNAUTHORIZED'
        );
      case 403:
        return ErrorFactory.create(
          ErrorType.AUTHORIZATION,
          message || 'You don\'t have permission to perform this action',
          'FORBIDDEN'
        );
      case 404:
        return ErrorFactory.create(
          ErrorType.NOT_FOUND,
          message || 'Resource not found',
          'NOT_FOUND'
        );
      case 408:
        return ErrorFactory.create(
          ErrorType.TIMEOUT,
          message || 'Request timeout',
          'TIMEOUT'
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return ErrorFactory.create(
          ErrorType.SERVER,
          message || 'Server error. Please try again later.',
          `SERVER_ERROR_${status}`
        );
      default:
        return ErrorFactory.create(
          ErrorType.UNKNOWN,
          message || 'An unexpected error occurred',
          `HTTP_${status}`
        );
    }
  }

  static isRecoverable(type: ErrorType): boolean {
    const recoverableErrors = [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.VALIDATION,
    ];
    return recoverableErrors.includes(type);
  }
}

// ==================== Error Handler ====================

export class ErrorHandler {
  private static handlers: Map<ErrorType, (error: AppError) => void> = new Map();

  static register(type: ErrorType, handler: (error: AppError) => void): void {
    this.handlers.set(type, handler);
  }

  static handle(error: AppError, showToast: boolean = true): void {
    // Log error
    console.error('[Error]', error);

    // Show toast notification
    if (showToast) {
      this.showErrorToast(error);
    }

    // Execute custom handler if registered
    const handler = this.handlers.get(error.type);
    if (handler) {
      handler(error);
    }

    // Execute default recovery strategy
    this.executeRecoveryStrategy(error);
  }

  private static showErrorToast(error: AppError): void {
    const toastOptions = {
      duration: 5000,
      action: error.recoverable
        ? {
            label: 'Retry',
            onClick: () => {
              // Retry logic would be implemented here
              toast.info('Retrying...');
            },
          }
        : undefined,
    };

    switch (error.type) {
      case ErrorType.NETWORK:
        toast.error('Network error. Please check your connection.', toastOptions);
        break;
      case ErrorType.AUTHENTICATION:
        toast.error('Please log in to continue.', toastOptions);
        break;
      case ErrorType.AUTHORIZATION:
        toast.error('You don\'t have permission to perform this action.', toastOptions);
        break;
      case ErrorType.VALIDATION:
        toast.error(error.message, toastOptions);
        break;
      case ErrorType.NOT_FOUND:
        toast.error('Resource not found.', toastOptions);
        break;
      case ErrorType.SERVER:
        toast.error('Server error. Please try again later.', toastOptions);
        break;
      case ErrorType.TIMEOUT:
        toast.error('Request timeout. Please try again.', toastOptions);
        break;
      default:
        toast.error(error.message || 'An unexpected error occurred.', toastOptions);
    }
  }

  private static executeRecoveryStrategy(error: AppError): void {
    switch (error.type) {
      case ErrorType.AUTHENTICATION:
        // Redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
        break;

      case ErrorType.NETWORK:
        // Check connection and retry
        if (navigator.onLine) {
          console.log('Connection restored, consider retrying');
        }
        break;

      case ErrorType.SERVER:
        // Log to error tracking service
        this.logToService(error);
        break;

      default:
        break;
    }
  }

  private static logToService(error: AppError): void {
    // Integration with error tracking services like Sentry
    // sentry.captureException(error);
    console.log('[Error Service]', error);
  }
}

// ==================== Error Boundary Utility ====================

export function wrapAsyncFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: AppError) => void
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error: any) {
      const appError = error instanceof Error
        ? ErrorFactory.create(
            ErrorType.UNKNOWN,
            error.message,
            error.name,
            error
          )
        : ErrorFactory.create(
            ErrorType.UNKNOWN,
            'An unexpected error occurred',
            undefined,
            error
          );

      if (errorHandler) {
        errorHandler(appError);
      } else {
        ErrorHandler.handle(appError);
      }

      throw appError;
    }
  }) as T;
}

// ==================== Validation Error Helpers ====================

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export class ValidationErrorHandler {
  static formatErrors(errors: ValidationError[]): string {
    return errors.map((e) => `${e.field}: ${e.message}`).join('\n');
  }

  static showErrors(errors: ValidationError[]): void {
    errors.forEach((error) => {
      toast.error(`${error.field}: ${error.message}`, {
        duration: 4000,
      });
    });
  }

  static createError(field: string, message: string, value?: any): ValidationError {
    return { field, message, value };
  }
}

// ==================== Retry Utilities ====================

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoff: boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = true,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      const delay = backoff ? delayMs * attempt : delayMs;

      if (onRetry) {
        onRetry(attempt, error);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ==================== Safe Execution ====================

export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback?: T,
  showError: boolean = true
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error: any) {
    if (showError) {
      const appError = ErrorFactory.create(
        ErrorType.UNKNOWN,
        error.message || 'Operation failed',
        error.code,
        error
      );
      ErrorHandler.handle(appError);
    }
    return fallback;
  }
}

// ==================== Setup Global Error Handlers ====================

export function setupGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const error = ErrorFactory.create(
      ErrorType.UNKNOWN,
      event.message,
      'UNCAUGHT_ERROR',
      { filename: event.filename, lineno: event.lineno, colno: event.colno }
    );
    ErrorHandler.handle(error, false);
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = ErrorFactory.create(
      ErrorType.UNKNOWN,
      event.reason?.message || 'Unhandled promise rejection',
      'UNHANDLED_REJECTION',
      event.reason
    );
    ErrorHandler.handle(error, false);
  });

  // Register default handlers
  ErrorHandler.register(ErrorType.AUTHENTICATION, (_error) => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  });

  ErrorHandler.register(ErrorType.NETWORK, (_error) => {
    // Queue failed requests for retry when connection is restored
    console.log('Network error - implementing offline queue');
  });
}

// ==================== Export ====================

export default {
  ErrorType,
  ErrorFactory,
  ErrorHandler,
  ValidationErrorHandler,
  wrapAsyncFunction,
  retryAsync,
  safeExecute,
  setupGlobalErrorHandlers,
};
