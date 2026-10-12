import { Response } from 'express';
import { PaginationMeta } from './pagination';

interface ApiResponseOptions<T> {
  res: Response;
  statusCode?: number;
  message?: string;
  data?: T;
  /** Pagination plus optional extras (e.g. unreadCount on notification list). */
  meta?: PaginationMeta & Record<string, unknown>;
  error?: any;
}

export const sendResponse = <T>({
  res,
  statusCode = 200,
  message = 'Success',
  data,
  meta,
  error,
}: ApiResponseOptions<T>): Response => {
  const success = statusCode >= 200 && statusCode < 300;
  return res.status(statusCode).json({
    success,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
    ...(error !== undefined && { error }),
  });
};
