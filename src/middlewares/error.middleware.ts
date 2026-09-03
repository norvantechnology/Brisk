import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { sendResponse } from '../utils/apiResponse';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any = null;

  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File exceeds maximum upload size.';
  } else if ((err as { code?: string }).code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field. Use profilePhoto, profilePhotoUrl, profileImage, or image for signup photo upload.';
  } else {
    logger.error('Unhandled Server Error:', err);
  }

  const appData =
    err instanceof AppError && err.data !== undefined
      ? typeof err.data === 'object' && err.data !== null && !Array.isArray(err.data)
        ? { ...(err.data as Record<string, unknown>), ...(err.code ? { code: err.code } : {}) }
        : err.data
      : err instanceof AppError && err.code
        ? { code: err.code }
        : undefined;

  sendResponse({
    res,
    statusCode,
    message,
    data: appData,
    error: errors || undefined,
  });
};
