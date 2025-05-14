/**
 * Tests for index.ts
 * 
 * These tests focus on the server setup and route configuration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock express and http modules
vi.mock('express', () => {
  const expressApp = {
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn(),
    static: vi.fn()
  };
  
  // Create the express function
  const expressFn: any = vi.fn(() => expressApp);
  
  // Add methods to the express function
  expressFn.json = vi.fn();
  expressFn.static = vi.fn(() => 'static-middleware');
  
  return { default: expressFn };
});

vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((port, callback) => {
      callback();
      return {
        address: vi.fn(() => ({ port }))
      };
    })
  }))
}));

// Mock WebSocketServer
vi.mock('../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn()
}));

// Mock routes
vi.mock('../../server/routes', () => ({
  apiRoutes: 'api-routes-mock'
}));

// Mock config.ts to prevent side effects
vi.mock('../../server/config', () => ({}));

describe('Express Server Setup', () => {
  // Capture console output
  const originalConsole = { ...console };
  
  beforeEach(() => {
    vi.resetModules();
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });
  
  afterEach(() => {
    // Restore console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Restore environment
    vi.restoreAllMocks();
  });
  
  it('should set up server with required middleware', async () => {
    // Arrange
    // Save original env
    const originalEnv = { ...process.env };
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Import the modules we need for testing
    const express = await import('express');
    const http = await import('http');
    const { WebSocketServer } = await import('../../server/services/WebSocketServer');
    
    // Act - import the module which sets up the server
    const indexModule = await import('../../server/index');
    
    // Assert middleware and routes are set up
    expect(express.default).toHaveBeenCalled();
    expect(express.json).toHaveBeenCalled();
    expect(express.default().use).toHaveBeenCalledWith('api-routes-mock');
    expect(express.static).toHaveBeenCalledWith('client/public');
    expect(http.createServer).toHaveBeenCalled();
    expect(WebSocketServer).toHaveBeenCalled();
    
    // Assert console logs for API key presence
    expect(console.log).toHaveBeenCalledWith('OpenAI API key status: Present');
    expect(console.warn).not.toHaveBeenCalled();
    
    // Restore env
    process.env = originalEnv;
  });

  it('should warn if no OpenAI API key is found', async () => {
    // Arrange
    // Save original env and remove API key
    const originalEnv = { ...process.env };
    delete process.env.OPENAI_API_KEY;
    
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Import the modules we need for testing
    const express = await import('express');
    
    // Act - import the module which sets up the server
    await import('../../server/index');
    
    // Assert middleware and warning logs
    expect(console.warn).toHaveBeenCalledWith('⚠️ No OPENAI_API_KEY found in environment variables');
    expect(console.warn).toHaveBeenCalledWith('Translation functionality will be limited');
    
    // Restore env
    process.env = originalEnv;
  });
  
  it('should set up CORS middleware', async () => {
    // Arrange
    // Save original env
    const originalEnv = { ...process.env };
    
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Create a mock request and response
    const req = { method: 'GET' };
    const res = {
      header: vi.fn(),
      sendStatus: vi.fn()
    };
    const next = vi.fn();
    
    // Import and capture express app
    const express = await import('express');
    
    // Act - import the module which sets up the server
    await import('../../server/index');
    
    // Find the CORS middleware function
    const corsMiddleware = express.default().use.mock.calls[0][0];
    
    // Execute the middleware
    corsMiddleware(req, res, next);
    
    // Assert
    expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(next).toHaveBeenCalled();
    
    // Restore env
    process.env = originalEnv;
  });
  
  it('should handle OPTIONS requests in CORS middleware', async () => {
    // Arrange
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Create a mock request and response for OPTIONS request
    const req = { method: 'OPTIONS' };
    const res = {
      header: vi.fn(),
      sendStatus: vi.fn()
    };
    const next = vi.fn();
    
    // Import and capture express app
    const express = await import('express');
    
    // Act - import the module which sets up the server
    await import('../../server/index');
    
    // Find the CORS middleware function
    const corsMiddleware = express.default().use.mock.calls[0][0];
    
    // Execute the middleware
    corsMiddleware(req, res, next);
    
    // Assert
    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
  
  it('should set up route handlers', async () => {
    // Arrange
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Import express to capture route handlers
    const express = await import('express');
    
    // Act - import the module which sets up the server
    await import('../../server/index');
    
    // Assert that routes are set up
    expect(express.default().get).toHaveBeenCalledWith('/student', expect.any(Function));
    expect(express.default().get).toHaveBeenCalledWith('/teacher', expect.any(Function));
    expect(express.default().get).toHaveBeenCalledWith('/metrics', expect.any(Function));
    expect(express.default().get).toHaveBeenCalledWith('/tests', expect.any(Function));
    expect(express.default().get).toHaveBeenCalledWith('/', expect.any(Function));
    expect(express.default().get).toHaveBeenCalledWith('*', expect.any(Function));
  });
  
  it('should handle route for student page', async () => {
    // Arrange
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Import express to capture route handlers
    const express = await import('express');
    
    // Act - import the module which sets up the server
    await import('../../server/index');
    
    // Find the student route handler
    const routeHandler = express.default().get.mock.calls.find(
      call => call[0] === '/student'
    )[1];
    
    // Mock request and response
    const req = {};
    const res = { sendFile: vi.fn() };
    
    // Execute the route handler
    routeHandler(req, res);
    
    // Assert
    expect(res.sendFile).toHaveBeenCalledWith('simple-student.html', { root: 'client/public' });
  });
  
  it('should handle route for teacher page', async () => {
    // Arrange
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Import express to capture route handlers
    const express = await import('express');
    
    // Act - import the module which sets up the server
    await import('../../server/index');
    
    // Find the teacher route handler
    const routeHandler = express.default().get.mock.calls.find(
      call => call[0] === '/teacher'
    )[1];
    
    // Mock request and response
    const req = { query: {} };
    const res = { sendFile: vi.fn() };
    
    // Execute the route handler
    routeHandler(req, res);
    
    // Assert
    expect(res.sendFile).toHaveBeenCalledWith('simple-speech-test.html', { root: 'client/public' });
  });
  
  it('should handle route for teacher page with demo query parameter', async () => {
    // Arrange
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Import express to capture route handlers
    const express = await import('express');
    
    // Act - import the module which sets up the server
    await import('../../server/index');
    
    // Find the teacher route handler
    const routeHandler = express.default().get.mock.calls.find(
      call => call[0] === '/teacher'
    )[1];
    
    // Mock request and response
    const req = { query: { demo: 'true' } };
    const res = { sendFile: vi.fn() };
    
    // Execute the route handler
    routeHandler(req, res);
    
    // Assert
    expect(res.sendFile).toHaveBeenCalledWith('simple-speech-test.html', { root: 'client/public' });
  });
  
  it('should handle server start error', async () => {
    // Arrange
    // Reset modules to force re-execution of code
    vi.resetModules();
    
    // Mock process.exit
    const exitMock = vi.spyOn(process, 'exit').mockImplementation(vi.fn() as any);
    
    // Mock http.createServer to throw an error
    vi.mocked(await import('http')).createServer.mockImplementation(() => {
      throw new Error('Server start error');
    });
    
    // Act - import the module which sets up the server
    try {
      await import('../../server/index');
    } catch (error) {
      // Error is expected
    }
    
    // Assert
    expect(console.error).toHaveBeenCalledWith('Error starting server:', expect.any(Error));
    expect(exitMock).toHaveBeenCalledWith(1);
    
    // Restore process.exit
    exitMock.mockRestore();
  });
});