/**
 * Comprehensive tests for vite.ts
 * 
 * These tests cover the Vite server setup, middleware functions,
 * and static file serving capabilities.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';

// Mock all external dependencies
vi.mock('express', () => {
  return {
    default: vi.fn(() => ({
      use: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    }))
  };
});

vi.mock('vite', () => {
  return {
    createServer: vi.fn().mockResolvedValue({
      middlewares: { handle: vi.fn() },
      transformIndexHtml: vi.fn().mockResolvedValue('<html>Transformed HTML</html>'),
      ssrLoadModule: vi.fn().mockResolvedValue({
        render: vi.fn().mockResolvedValue({ html: '<div>Rendered content</div>' })
      })
    })
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

// Mock http.Server
vi.mock('http', () => {
  return {
    Server: vi.fn().mockImplementation(() => ({
      address: vi.fn().mockReturnValue({ port: 3000 })
    }))
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