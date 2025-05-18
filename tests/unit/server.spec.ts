
/**
 * Server Tests
 *
 * This file tests the Express server configuration and CORS middleware.
 * These tests focus on the actual server functionality without mocking the SUT.
 */
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// Ensure Vitest types are available
/// <reference types="vitest" />
/// <reference types="vitest/globals" />
import express, { Request, Response, NextFunction, Express } from 'express';
import { configureCorsMiddleware } from '../../server/server';

describe('Server Configuration', () => {
  describe('CORS Middleware', () => {
    let app: Express;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      app = express();
      req = {};
      res = {
        header: vi.fn(),
        sendStatus: vi.fn()
      };
      next = vi.fn();
    });

    it('should configure CORS headers for normal requests', () => {
      // Arrange
      req.method = 'GET';

      // Act
      configureCorsMiddleware(app);
      // Execute the middleware directly
      const middleware = app._router.stack[app._router.stack.length - 1].handle;
      middleware(req as Request, res as Response, next as NextFunction);

      // Assert
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.stringContaining('GET'));
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', expect.stringContaining('Content-Type'));
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(next).toHaveBeenCalled();
    });

    it('should handle OPTIONS requests', () => {
      // Arrange
      req.method = 'OPTIONS';

      // Act
      configureCorsMiddleware(app);
      // Execute the middleware directly
      const middleware = app._router.stack[app._router.stack.length - 1].handle;
      middleware(req as Request, res as Response, next as NextFunction);

      // Assert
      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
