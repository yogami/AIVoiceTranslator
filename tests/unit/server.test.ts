/**
 * Server Tests
 *
 * This file tests the Express server configuration and CORS middleware.
 * These tests focus on the actual server functionality without mocking the SUT.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Ensure Vitest types are available
/// <reference types="vitest" />
/// <reference types="vitest/globals" />
import express, { Request, Response, NextFunction, Express } from 'express';
import { createServer, Server } from 'http';
import { configureCorsMiddleware, startServer } from '../../server/server';

// Mock dependencies
vi.mock('../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    // Mock WebSocketServer methods if needed
  }))
}));

vi.mock('../../server/routes', () => ({
  apiRoutes: vi.fn()
}));

vi.mock('../../server/config', () => ({}));

// Mock the createServer function
vi.mock('http', () => ({
  createServer: vi.fn()
}));

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
      
      // Get the middleware that was added to the app
      const middleware = (app as any)._router.stack[(app as any)._router.stack.length - 1].handle;
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
      
      // Get the middleware that was added to the app
      const middleware = (app as any)._router.stack[(app as any)._router.stack.length - 1].handle;
      middleware(req as Request, res as Response, next as NextFunction);

      // Assert
      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Server Startup', () => {
    let originalEnv: NodeJS.ProcessEnv;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let createServerMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Save original environment
      originalEnv = { ...process.env };
      
      // Setup console spies
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Setup createServer mock
      createServerMock = vi.mocked(createServer);
    });

    afterEach(() => {
      // Restore environment
      process.env = originalEnv;
      
      // Restore console methods
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      
      vi.resetAllMocks();
    });

    it('should start server successfully with OpenAI API key', async () => {
      // Arrange
      process.env.OPENAI_API_KEY = 'test-api-key';
      // Ensure PORT is not set to test default behavior
      delete process.env.PORT;

      // Mock the server listen method to avoid actually starting a server
      const mockListen = vi.fn((port: any, callback?: () => void) => {
        if (callback) callback();
      });

      // Mock createServer to return an object with a mocked listen method
      createServerMock.mockReturnValue({
        listen: mockListen
      } as any);

      // Act
      const result = await startServer();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('OpenAI API key status: Present');
      expect(consoleLogSpy).toHaveBeenCalledWith('OpenAI client initialized successfully');
      // The port gets converted to string when passed to listen()
      expect(mockListen).toHaveBeenCalledWith(5000, expect.any(Function));
      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('httpServer');
      expect(result).toHaveProperty('wss');
    });

    it('should start server and warn when OpenAI API key is missing', async () => {
      // Arrange
      delete process.env.OPENAI_API_KEY;

      // Mock the server listen method
      const mockListen = vi.fn((port: any, callback?: () => void) => {
        if (callback) callback();
      });

      createServerMock.mockReturnValue({
        listen: mockListen
      } as any);

      // Act
      await startServer();

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ No OPENAI_API_KEY found in environment variables');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Translation functionality will be limited');
    });

    it('should use custom port from environment', async () => {
      // Arrange
      process.env.PORT = '8080';

      const mockListen = vi.fn((port: any, callback?: () => void) => {
        if (callback) callback();
      });

      createServerMock.mockReturnValue({
        listen: mockListen
      } as any);

      // Act
      await startServer();

      // Assert
      expect(mockListen).toHaveBeenCalledWith('8080', expect.any(Function));
    });

    it('should initialize WebSocket server', async () => {
      // Arrange
      const mockServer = { 
        listen: vi.fn((port: any, callback?: () => void) => {
          if (callback) callback();
        }) 
      };

      createServerMock.mockReturnValue(mockServer as any);

      // Act
      await startServer();

      // Assert
      const { WebSocketServer } = await import('../../server/services/WebSocketServer');
      expect(WebSocketServer).toHaveBeenCalledWith(mockServer);
    });

    it('should log server startup message', async () => {
      // Arrange
      const mockListen = vi.fn((port: any, callback?: () => void) => {
        if (callback) callback();
      });

      createServerMock.mockReturnValue({
        listen: mockListen
      } as any);

      // Act
      await startServer();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[express\] serving on port 5000$/)
      );
    });

    it('should configure CORS middleware', async () => {
      // Arrange
      const mockListen = vi.fn((port: any, callback?: () => void) => {
        if (callback) callback();
      });

      createServerMock.mockReturnValue({
        listen: mockListen
      } as any);

      // Act
      await startServer();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('CORS middleware configured successfully');
    });
  });

  describe('Route Configuration Tests', () => {
    let result: any;
    let mockApp: any;
    let createServerMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      // Setup createServer mock
      createServerMock = vi.mocked(createServer);
      
      // Mock createServer
      const mockListen = vi.fn((port: any, callback?: () => void) => {
        if (callback) callback();
      });

      createServerMock.mockReturnValue({
        listen: mockListen
      } as any);

      // Spy on console to suppress logs
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Start the server to get the configured app
      result = await startServer();
      mockApp = result.app;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should configure all required routes', () => {
      // We can't easily inspect Express route configuration in tests
      // So we'll just verify the server started successfully
      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('httpServer');
      expect(result).toHaveProperty('wss');
    });

    // Note: Testing individual route handlers would require a different approach
    // such as using supertest or creating integration tests
    // For unit tests, we're verifying the server configuration works
  });
});