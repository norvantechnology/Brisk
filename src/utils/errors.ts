export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly data?: unknown;

  constructor(
    message: string,
    statusCode: number,
    options?: {
      isOperational?: boolean;
      code?: string;
      data?: unknown;
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    this.code = options?.code;
    this.data = options?.data;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', options?: { code?: string; data?: unknown }) {
    super(message, 400, options);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', options?: { code?: string; data?: unknown }) {
    super(message, 401, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', options?: { code?: string; data?: unknown }) {
    super(message, 403, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', options?: { code?: string; data?: unknown }) {
    super(message, 404, options);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', options?: { code?: string; data?: unknown }) {
    super(message, 409, options);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests', options?: { code?: string; data?: unknown }) {
    super(message, 429, options);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(message, 500, { isOperational: false });
  }
}
