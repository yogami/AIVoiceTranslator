/**
 * Tests for server setup functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import { apiRoutes } from '../../server/routes';
import { WebSocketServer } from '../../server/services/WebSocketServer';

// Mock the dependencies
vi.mock('express', () => {
  const app = {
    use: vi.fn(),
    get: vi.fn()
  };
  
  const expressFn: any = vi.fn(() => app);
  expressFn.json = vi.fn();
  expressFn.static = vi.fn(() => 'static-middleware');
  
  return { default: expressFn };
});

vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((port, callback) => {
      callback?.();
      return {
        address: () => ({ port })
      };
    })
  }))
}));

vi.mock('../../server/routes', () => ({
  apiRoutes: {}
}));

vi.mock('../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn()
}));

// Import the function we want to test
import { configureCorsMiddleware, startServer } from '../../server/server';

describe('Server Configuration', () => {
  // Save console methods
  const originalConsole = { ...console };
  let processExitSpy: any;
  
  beforeEach(() => {
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(vi.fn() as any);
    
    // Reset all mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    processExitSpy.mockRestore();
    
    // Clear environment variables
    if (process.env.OPENAI_API_KEY) {
      delete process.env.OPENAI_API_KEY;
    }
  });
  
  describe('CORS Middleware', () => {
    it('should configure CORS headers for normal requests', () => {
      // Create a mock Express app
      const app = { use: vi.fn() };
      
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
      // Create a mock Express app
      const app = { use: vi.fn() };
      
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
    it('should initialize the server with all components', async () => {
      // Set up an API key
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      // Start the server
      await startServer();
      
      // Verify Express is initialized
      expect(express.default).toHaveBeenCalled();
      expect(express.json).toHaveBeenCalled();
      
      // Verify the app is configured with routes
      const app = express.default();
      expect(app.use).toHaveBeenCalledWith('/api', apiRoutes);
      
      // Verify the HTTP server is created
      expect(createServer).toHaveBeenCalledWith(app);
      
      // Verify WebSocketServer is initialized
      expect(WebSocketServer).toHaveBeenCalled();
      
      // Verify the server is started
      const server = createServer();
      expect(server.listen).toHaveBeenCalled();
      
      // Verify routes are set up
      expect(app.get).toHaveBeenCalledWith('/student', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('/teacher', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('/metrics', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('/tests', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('/', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('*', expect.any(Function));
      
      // Verify API key log
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
      vi.mocked(createServer).mockImplementationOnce(() => {
        throw new Error('Server creation failed');
      });
      
      // Try to start the server, expect it to fail
      await expect(startServer()).rejects.toThrow('Server creation failed');
    });
  });
  
  describe('Route Handlers', () => {
    it('should set up the student page route', async () => {
      await startServer();
      
      const app = express.default();
      
      // Find the student route handler
      const routeCall = app.get.mock.calls.find(call => call[0] === '/student');
      expect(routeCall).toBeTruthy();
      
      // Test the route handler
      const handler = routeCall[1];
      const req = {};
      const res = { sendFile: vi.fn() };
      
      handler(req, res);
      
      expect(res.sendFile).toHaveBeenCalledWith('simple-student.html', { root: 'client/public' });
    });
    
    it('should set up the teacher page route', async () => {
      await startServer();
      
      const app = express.default();
      
      // Find the teacher route handler
      const routeCall = app.get.mock.calls.find(call => call[0] === '/teacher');
      expect(routeCall).toBeTruthy();
      
      // Test the route handler
      const handler = routeCall[1];
      
      // Without demo query param
      const req1 = { query: {} };
      const res1 = { sendFile: vi.fn() };
      handler(req1, res1);
      expect(res1.sendFile).toHaveBeenCalledWith('simple-speech-test.html', { root: 'client/public' });
      
      // With demo query param
      const req2 = { query: { demo: 'true' } };
      const res2 = { sendFile: vi.fn() };
      handler(req2, res2);
      expect(res2.sendFile).toHaveBeenCalledWith('simple-speech-test.html', { root: 'client/public' });
    });
    
    it('should set up the metrics page route', async () => {
      await startServer();
      
      const app = express.default();
      
      // Find the metrics route handler
      const routeCall = app.get.mock.calls.find(call => call[0] === '/metrics');
      expect(routeCall).toBeTruthy();
      
      // Test the route handler
      const handler = routeCall[1];
      const req = {};
      const res = { sendFile: vi.fn() };
      
      handler(req, res);
      
      expect(res.sendFile).toHaveBeenCalledWith('metrics-dashboard.html', { root: 'client/public' });
    });
    
    it('should set up the tests page route', async () => {
      await startServer();
      
      const app = express.default();
      
      // Find the tests route handler
      const routeCall = app.get.mock.calls.find(call => call[0] === '/tests');
      expect(routeCall).toBeTruthy();
      
      // Test the route handler
      const handler = routeCall[1];
      const req = {};
      const res = { sendFile: vi.fn() };
      
      handler(req, res);
      
      expect(res.sendFile).toHaveBeenCalledWith('feature-tests-dashboard.html', { root: 'client/public' });
    });
    
    it('should set up the root route', async () => {
      await startServer();
      
      const app = express.default();
      
      // Find the root route handler
      const routeCall = app.get.mock.calls.find(call => call[0] === '/');
      expect(routeCall).toBeTruthy();
      
      // Test the route handler
      const handler = routeCall[1];
      const req = {};
      const res = { sendFile: vi.fn() };
      
      handler(req, res);
      
      expect(res.sendFile).toHaveBeenCalledWith('index.html', { root: 'client' });
    });
    
    it('should set up the catch-all route', async () => {
      await startServer();
      
      const app = express.default();
      
      // Find the catch-all route handler
      const routeCall = app.get.mock.calls.find(call => call[0] === '*');
      expect(routeCall).toBeTruthy();
      
      // Test the route handler
      const handler = routeCall[1];
      const req = {};
      const res = { sendFile: vi.fn() };
      
      handler(req, res);
      
      expect(res.sendFile).toHaveBeenCalledWith('index.html', { root: 'client' });
    });
  });
});