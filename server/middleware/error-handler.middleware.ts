/**
 * API Error Handling Utilities
 * 
 * Centralized error handling and async wrapper utilities
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      return Promise.resolve(fn(req, res, next)).catch(next);
    } catch (error) {
      next(error);
    }
};

/**
 * Global error handler for API routes
 */
export const apiErrorHandler = (error: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', error);

  // Handle custom ApiError
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }

  // Handle database errors
  if (error.name === 'StorageError') {
    return res.status(500).json({
      success: false,
      error: 'Database operation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }

  // Default error handler
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    timestamp: new Date().toISOString()
  });
};
