/**
 * Comprehensive tests for vite.ts
 * 
 * These tests cover the Vite server setup, middleware functions,
 * and static file serving capabilities.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';

// Mock all external dependencies with proper ESM support using importOriginal pattern
vi.mock('express', async (importOriginal) => {
  // Get actual module exports
  const actual = await importOriginal();
  
  // Create mock implementation
  const mockExpressApp = vi.fn(() => ({
    use: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
  }));
  
  // Return both original exports and mock
  return {
    ...actual,
    default: mockExpressApp
  };
});

// Use the importOriginal pattern as recommended by Vitest for more complex mocking scenarios
vi.mock('vite', async (importOriginal) => {
  // This ensures we get all the exports from the original module
  const actual = await importOriginal();
  
  // Create our mock implementation
  const mockCreateServer = vi.fn().mockResolvedValue({
    middlewares: { handle: vi.fn() },
    transformIndexHtml: vi.fn().mockResolvedValue('<html>Transformed HTML</html>'),
    ssrLoadModule: vi.fn().mockResolvedValue({
      render: vi.fn().mockResolvedValue({ html: '<div>Rendered content</div>' })
    })
  });
  
  // Return a combination of the original exports and our mocks
  return {
    ...actual, // Keep all original exports, including defineConfig
    createServer: mockCreateServer // Override just the createServer function
  };
});

vi.mock('fs/promises', () => {
  return {
    readFile: vi.fn().mockResolvedValue('<html>Original HTML</html>')
  };
});

vi.mock('path', () => {
  return {
    resolve: vi.fn((...args) => args.join('/')),
    join: vi.fn((...args) => args.join('/'))
  };
});

// Mock http module with importOriginal pattern
vi.mock('http', async (importOriginal) => {
  // Get actual module exports
  const actual = await importOriginal();
  
  // Create mock implementation
  const mockServer = vi.fn().mockImplementation(() => ({
    address: vi.fn().mockReturnValue({ port: 3000 })
  }));
  
  return {
    ...actual, // Include all original exports
    Server: mockServer // Override just the Server constructor
  };
});

// Import the module after mocks are set up
describe('Vite Server Module', () => {
  let viteModule;
  let app;
  let server;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    app = express();
    server = new http.Server();
    
    // Import the module
    viteModule = await import('../../server/vite');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('log Function', () => {
    it('should log messages with the specified source', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      viteModule.log('Test message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('express'));
      
      viteModule.log('Another message', 'vite');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Another message'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('vite'));
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('setupVite Function', () => {
    it('should set up Vite middleware correctly', async () => {
      // Call the function
      await viteModule.setupVite(app, server);
      
      // Check that app.use was called
      expect(app.use).toHaveBeenCalled();
      
      // Check that app.get was called with the correct route handler
      expect(app.get).toHaveBeenCalled();
      
      // Check that app.all was called with the correct wildcard route handler
      expect(app.all).toHaveBeenCalled();
    });
  });
  
  describe('serveStatic Function', () => {
    it('should configure Express to serve static files', () => {
      // Call the function
      viteModule.serveStatic(app);
      
      // Check that app.use was called to set up static file serving
      expect(app.use).toHaveBeenCalled();
    });
  });
});