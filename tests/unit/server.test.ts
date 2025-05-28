/**
 * Server Unit Tests
 *
 * Tests the startServer function behavior and contracts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Only mock external dependencies that we don't want to test
vi.mock('../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    close: vi.fn()
  }))
}));

// Mock the routes module with a proper Express router
vi.mock('../../server/routes', () => {
  const express = require('express');
  return {
    apiRoutes: express.Router()
  };
});

// Mock console to avoid noise in test output
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
};

import { startServer, configureCorsMiddleware } from '../../server/server';
import { WebSocketServer } from '../../server/services/WebSocketServer';

describe('Server Unit Tests', () => {
  let originalEnv: string | undefined;
  
  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
  });

  describe('startServer', () => {
    it('should return an object with app, httpServer, and wss properties', async () => {
      const result = await startServer();
      
      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('httpServer');
      expect(result).toHaveProperty('wss');
      
      // Verify the returned objects have the expected types
      expect(typeof result.app).toBe('function'); // Express app is a function
      expect(result.httpServer).toBeDefined();
      expect(result.wss).toBeDefined();
      
      // Clean up
      result.httpServer.close();
    });

    it('should create a WebSocket server instance', async () => {
      const result = await startServer();
      
      expect(WebSocketServer).toHaveBeenCalledTimes(1);
      expect(WebSocketServer).toHaveBeenCalledWith(result.httpServer);
      
      // Clean up
      result.httpServer.close();
    });

    it('should log warning when OPENAI_API_KEY is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const result = await startServer();
      
      expect(consoleSpy.warn).toHaveBeenCalledWith('⚠️ No OPENAI_API_KEY found in environment variables');
      expect(consoleSpy.warn).toHaveBeenCalledWith('Translation functionality will be limited');
      
      // Clean up
      result.httpServer.close();
    });

    it('should log success when OPENAI_API_KEY is present', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const result = await startServer();
      
      expect(consoleSpy.log).toHaveBeenCalledWith('OpenAI API key status: Present');
      
      // Clean up
      result.httpServer.close();
    });

    it('should use PORT environment variable when provided', async () => {
      const originalPort = process.env.PORT;
      process.env.PORT = '3000';
      
      const result = await startServer();
      
      // We can't easily test the actual port without starting the server,
      // but we can verify the server was created successfully
      expect(result.httpServer).toBeDefined();
      
      // Clean up
      result.httpServer.close();
      process.env.PORT = originalPort;
    });
  });

  describe('configureCorsMiddleware', () => {
    it('should add CORS middleware to the app', () => {
      const mockApp = {
        use: vi.fn()
      } as any;
      
      configureCorsMiddleware(mockApp);
      
      expect(mockApp.use).toHaveBeenCalledTimes(1);
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should configure middleware that sets CORS headers', () => {
      const mockApp = { use: vi.fn() } as any;
      const mockReq = { method: 'GET' } as any;
      const mockRes = {
        header: vi.fn(),
        sendStatus: vi.fn()
      } as any;
      const mockNext = vi.fn();
      
      configureCorsMiddleware(mockApp);
      
      // Get the middleware function that was passed to app.use
      const middlewareFunction = mockApp.use.mock.calls[0][0];
      
      // Call the middleware function
      middlewareFunction(mockReq, mockRes, mockNext);
      
      // Verify CORS headers were set
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle OPTIONS requests', () => {
      const mockApp = { use: vi.fn() } as any;
      const mockReq = { method: 'OPTIONS' } as any;
      const mockRes = {
        header: vi.fn(),
        sendStatus: vi.fn()
      } as any;
      const mockNext = vi.fn();
      
      configureCorsMiddleware(mockApp);
      
      const middlewareFunction = mockApp.use.mock.calls[0][0];
      middlewareFunction(mockReq, mockRes, mockNext);
      
      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
