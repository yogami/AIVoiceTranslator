/**
 * Server Tests
 * 
 * This file tests the Express server configuration and CORS middleware.
 * These tests focus on the actual server functionality without mocking the SUT.
 */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { configureCorsMiddleware } from '../../server/server';

// No mocking of the SUT (server.ts), only dependencies where needed
describe('Server Configuration', () => {
  describe('CORS Middleware', () => {
    it('should configure CORS headers for normal requests', () => {
      // Arrange
      const app = express();
      const req = {
        method: 'GET'
      } as express.Request;
      
      const res = {
        header: vi.fn(),
        sendStatus: vi.fn()
      } as unknown as express.Response;
      
      const next = vi.fn();
      
      // Act
      configureCorsMiddleware(app);
      // Execute the middleware directly
      app._router.stack[app._router.stack.length - 1].handle(req, res, next);
      
      // Assert
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.stringContaining('GET'));
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', expect.stringContaining('Content-Type'));
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle OPTIONS requests', () => {
      // Arrange
      const app = express();
      const req = {
        method: 'OPTIONS'
      } as express.Request;
      
      const res = {
        header: vi.fn(),
        sendStatus: vi.fn()
      } as unknown as express.Response;
      
      const next = vi.fn();
      
      // Act
      configureCorsMiddleware(app);
      // Execute the middleware directly
      app._router.stack[app._router.stack.length - 1].handle(req, res, next);
      
      // Assert
      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });
  });
});