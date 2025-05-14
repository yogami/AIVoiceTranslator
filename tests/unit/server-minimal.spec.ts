/**
 * Tests for server setup functionality - Minimal version
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('express', () => {
  const mockRouter = vi.fn(() => ({
    use: vi.fn(),
    get: vi.fn()
  }));
  
  // Mock express.json middleware
  const jsonMiddleware = vi.fn();
  
  // Mock express
  const mockExpress = vi.fn(() => ({
    use: vi.fn(),
    get: vi.fn()
  }));
  
  // Add properties to express
  mockExpress.json = jsonMiddleware;
  mockExpress.static = vi.fn();
  mockExpress.Router = mockRouter;
  
  return {
    default: mockExpress
  };
});

vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((port, callback) => {
      if (callback) callback();
      return {
        address: () => ({ port })
      };
    })
  }))
}));

vi.mock('../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn()
}));

vi.mock('../../server/routes', () => ({
  apiRoutes: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

// Import after mocking
import { configureCorsMiddleware, startServer } from '../../server/server';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { apiRoutes } from '../../server/routes';

describe('Server Configuration - Minimal', () => {
  // Save original console methods
  const originalConsole = { ...console };
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Restore environment variables
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Restore environment variables
    process.env = originalEnv;
  });
  
  describe('CORS Middleware', () => {
    it('should configure CORS headers for normal requests', () => {
      // The app mock
      const app = {
        use: vi.fn()
      };
      
      // Configure CORS
      configureCorsMiddleware(app as any);
      
      // Get the middleware function
      const middleware = app.use.mock.calls[0][0];
      
      // Create mock request, response, and next function
      const req = { method: 'GET' };
      const res = { header: vi.fn() };
      const next = vi.fn();
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify headers are set correctly
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 
        'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle OPTIONS requests', () => {
      // The app mock
      const app = {
        use: vi.fn()
      };
      
      // Configure CORS
      configureCorsMiddleware(app as any);
      
      // Get the middleware function
      const middleware = app.use.mock.calls[0][0];
      
      // Create mock request, response, and next function
      const req = { method: 'OPTIONS' };
      const res = { header: vi.fn(), sendStatus: vi.fn() };
      const next = vi.fn();
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify response is sent
      expect(res.sendStatus).toHaveBeenCalledWith(200);
      
      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe('Server Startup', () => {
    it('should initialize the server with all components when OpenAI API key is present', async () => {
      // Set up an API key
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      // Start the server
      await startServer();
      
      // Verify Express is initialized
      expect(express).toHaveBeenCalled();
      expect(express.json).toHaveBeenCalled();
      
      // Verify CORS middleware is applied
      const app = express();
      expect(app.use).toHaveBeenCalled();
      
      // Verify routes are set up
      expect(app.use).toHaveBeenCalledWith('/api', apiRoutes);
      
      // Verify HTTP server is created
      expect(createServer).toHaveBeenCalledWith(app);
      
      // Verify WebSocket server is initialized
      expect(WebSocketServer).toHaveBeenCalled();
      
      // Verify port is used
      const server = createServer();
      expect(server.listen).toHaveBeenCalled();
      
      // Verify OpenAI API key presence is logged
      expect(console.log).toHaveBeenCalledWith('OpenAI API key status: Present');
    });
    
    it('should warn about missing OpenAI API key', async () => {
      // Ensure API key is not set
      delete process.env.OPENAI_API_KEY;
      
      // Start the server
      await startServer();
      
      // Verify warning is logged
      expect(console.warn).toHaveBeenCalledWith('⚠️ No OPENAI_API_KEY found in environment variables');
      expect(console.warn).toHaveBeenCalledWith('Translation functionality will be limited');
    });
    
    it('should use provided port or default to 5000', async () => {
      // Test with custom port
      process.env.PORT = '8080';
      await startServer();
      
      const server = createServer();
      expect(server.listen).toHaveBeenCalledWith('8080', expect.any(Function));
      
      // Test with default port
      delete process.env.PORT;
      vi.clearAllMocks();
      
      await startServer();
      expect(server.listen).toHaveBeenCalledWith(5000, expect.any(Function));
    });
    
    it('should handle server startup errors', async () => {
      // Mock createServer to throw an error
      const errorMessage = 'Server creation failed';
      vi.mocked(createServer).mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });
      
      // Try to start the server
      await expect(startServer()).rejects.toThrow(errorMessage);
    });
  });
});