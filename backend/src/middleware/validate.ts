import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';

const mapValidationError = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

const validate = (schema: ZodTypeAny, source: 'body' | 'query' | 'params') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: mapValidationError(result.error),
      });
    }

    req[source] = result.data;
    return next();
  };

export const validateBody = (schema: ZodTypeAny) => validate(schema, 'body');
export const validateQuery = (schema: ZodTypeAny) => validate(schema, 'query');
export const validateParams = (schema: ZodTypeAny) => validate(schema, 'params');

export { z };
