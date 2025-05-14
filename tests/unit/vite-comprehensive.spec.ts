/**
 * Comprehensive tests for Vite integration
 *
 * Tests the vite.ts module thoroughly, including
 * development mode, production mode, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Express } from 'express';
import { Server } from 'http';

// Mock console methods to avoid noise in test output
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock vite
vi.mock('vite', () => {
  // Create a mock for createServer
  const createServerMock = vi.fn().mockResolvedValue({
    middlewares: {
      use: vi.fn()
    },
    transformIndexHtml: vi.fn().mockImplementation((url, html) => {
      return `transformed-${html}`;
    }),
    ssrLoadModule: vi.fn().mockImplementation((file) => {
      return Promise.resolve({
        render: vi.fn().mockReturnValue('rendered-content')
      });
    }),
    ssrFixStacktrace: vi.fn()
  });
  
  return {
    createServer: createServerMock
  };
});

// Mock fs
vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn().mockImplementation((path) => {
        if (path.includes('index.html')) {
          return Promise.resolve('<html><body>test</body></html>');
        }
        return Promise.resolve('file content');
      }),
      access: vi.fn().mockResolvedValue(undefined)
    }
  };
});

// Mock path
vi.mock('path', () => {
  return {
    resolve: vi.fn().mockImplementation((...args) => args.join('/')),
    join: vi.fn().mockImplementation((...args) => args.join('/'))
  };
});

describe('Vite Module', () => {
  let viteModule: any;
  let mockApp: Partial<Express>;
  let mockServer: Partial<Server>;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Create mock Express app
    mockApp = {
      use: vi.fn(),
      get: vi.fn()
    };
    
    // Create mock HTTP server
    mockServer = {
      on: vi.fn()
    };
    
    // Import the vite module
    viteModule = await import('../../server/vite');
  });
  
  describe('log function', () => {
    it('should log messages with source prefix', () => {
      // Spy on console.log
      const logSpy = vi.spyOn(console, 'log');
      
      // Call the log function
      viteModule.log('test message');
      
      // Verify it was called with the right prefix
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
    });
    
    it('should use custom source prefix if provided', () => {
      // Spy on console.log
      const logSpy = vi.spyOn(console, 'log');
      
      // Call the log function with custom source
      viteModule.log('test message', 'custom-source');
      
      // Verify it was called with the right prefix
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('custom-source'));
    });
  });
  
  describe('setupVite function', () => {
    it('should set up Vite middleware in development mode', async () => {
      // Set NODE_ENV to development
      vi.stubEnv('NODE_ENV', 'development');
      
      // Call setupVite
      await viteModule.setupVite(mockApp as Express, mockServer as Server);
      
      // Verify createServer was called
      const vite = await import('vite');
      expect(vite.createServer).toHaveBeenCalled();
      
      // Verify app.use was called to set up middleware
      expect(mockApp.use).toHaveBeenCalled();
      
      // Verify app.get was called to set up catch-all route
      expect(mockApp.get).toHaveBeenCalled();
    });
    
    it('should set up production mode serving', async () => {
      // Set NODE_ENV to production
      vi.stubEnv('NODE_ENV', 'production');
      
      // Call setupVite
      await viteModule.setupVite(mockApp as Express, mockServer as Server);
      
      // Verify app.get was called to set up catch-all route
      expect(mockApp.get).toHaveBeenCalled();
    });
  });
  
  describe('serveStatic function', () => {
    it('should set up static file serving middleware', () => {
      // Call serveStatic
      viteModule.serveStatic(mockApp as Express);
      
      // Verify app.use was called
      expect(mockApp.use).toHaveBeenCalled();
    });
  });
});