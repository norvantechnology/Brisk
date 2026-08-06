import { Response } from 'express';

interface ApiResponseOptions<T> {
  res: Response;
  statusCode?: number;
  message?: string;
  data?: T;
  error?: any;
}

export const sendResponse = <T>({
  res,
  statusCode = 200,
  message = 'Success',
  data,
  error,
}: ApiResponseOptions<T>): Response => {
  const success = statusCode >= 200 && statusCode < 300;
  return res.status(statusCode).json({
    success,
    message,
    ...(data !== undefined && { data }),
    ...(error !== undefined && { error }),
  });
};
