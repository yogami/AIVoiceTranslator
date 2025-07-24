/**
 * Error Handler Middleware Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ApiError, asyncHandler, apiErrorHandler } from '../../../server/middleware/error-handler.middleware.js';

// Mock Express objects
const mockRequest = () => ({} as Request);
const mockResponse = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};
const mockNext = () => vi.fn() as NextFunction;

describe('Error Handler Middleware', () => {
  describe('ApiError', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError(400, 'Bad Request', { field: 'email' });

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.name).toBe('ApiError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create ApiError without details', () => {
      const error = new ApiError(500, 'Internal Server Error');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
      expect(error.details).toBeUndefined();
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      const asyncFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      const error = new Error('Async error');
      const asyncFn = vi.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle sync errors in async function', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      const error = new Error('Sync error');
      const asyncFn = vi.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('apiErrorHandler', () => {
    let req: Request;
    let res: Response;
    let next: NextFunction;
    let consoleSpy: any;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle ApiError correctly', () => {
      const error = new ApiError(400, 'Validation failed', { field: 'email' });

      apiErrorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: { field: 'email' },
        timestamp: expect.any(String)
      });
      expect(consoleSpy).toHaveBeenCalledWith('API Error:', error);
    });

    it('should handle ValidationError', () => {
      const error = new Error('Field is required');
      error.name = 'ValidationError';

      apiErrorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: 'Field is required',
        timestamp: expect.any(String)
      });
    });

    it('should handle StorageError', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Database connection failed');
      error.name = 'StorageError';

      apiErrorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database operation failed',
        details: 'Database connection failed',
        timestamp: expect.any(String)
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle StorageError in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');
      error.name = 'StorageError';

      apiErrorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database operation failed',
        details: 'Internal server error',
        timestamp: expect.any(String)
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle generic errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Something went wrong');

      apiErrorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        details: 'Something went wrong',
        timestamp: expect.any(String)
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle generic errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Something went wrong');

      apiErrorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        details: undefined,
        timestamp: expect.any(String)
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should include timestamp in ISO format', () => {
      const error = new ApiError(400, 'Test error');
      const beforeTime = new Date().toISOString();

      apiErrorHandler(error, req, res, next);

      const callArgs = (res.json as any).mock.calls[0][0];
      const timestamp = callArgs.timestamp;
      const afterTime = new Date().toISOString();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);
    });
  });
});
