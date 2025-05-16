/**
 * Vite Integration Tests (Consolidated)
 * 
 * A comprehensive test suite for Vite integration in the server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';

// Mock dependencies
vi.mock('express', () => {
  const app = {
    use: vi.fn(),
    get: vi.fn()
  };
  return {
    default: vi.fn(() => app),
    static: vi.fn(() => 'static-middleware')
  };
});

vi.mock('vite', () => ({
  createServer: vi.fn().mockResolvedValue({
    middlewares: 'vite-middleware',
    ssrLoadModule: vi.fn().mockResolvedValue({
      render: vi.fn().mockResolvedValue('<div>Rendered Content</div>')
    }),
    transformIndexHtml: vi.fn().mockResolvedValue('<html>Transformed HTML</html>')
  })
}));

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue('<html>Original HTML</html>'),
    access: vi.fn().mockResolvedValue(true)
  },
  existsSync: vi.fn().mockReturnValue(true)
}));

vi.mock('../../server/config', () => ({
  ROOT_DIR: '/mockdir',
  CLIENT_OUT_DIR: '/mockdir/dist/client',
  NODE_ENV: 'development',
  IS_PRODUCTION: false
}));

// Import module under test
import { setupVite, serveStatic, log } from '../../server/vite';

describe('Vite Integration', () => {
  let app;
  let server;
  
  beforeEach(() => {
    app = express();
    server = http.createServer(app);
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Development Mode', () => {
    it('should set up Vite middleware in development mode', async () => {
      // Arrange
      vi.mock('../../server/config', () => ({
        ROOT_DIR: '/mockdir',
        CLIENT_OUT_DIR: '/mockdir/dist/client',
        NODE_ENV: 'development',
        IS_PRODUCTION: false
      }), { virtual: true });
      
      // Act
      await setupVite(app, server);
      
      // Assert
      expect(app.use).toHaveBeenCalledWith('vite-middleware');
      expect(app.get).toHaveBeenCalledWith('*', expect.any(Function));
    });
    
    it('should handle SSR rendering in development mode', async () => {
      // Arrange
      const req = { url: '/' };
      const res = {
        status: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        end: vi.fn()
      };
      
      // Mock the GET route handler
      let routeHandler;
      app.get.mockImplementation((path, handler) => {
        if (path === '*') routeHandler = handler;
      });
      
      // Act
      await setupVite(app, server);
      
      // Ensure routeHandler was set
      expect(routeHandler).toBeDefined();
      
      // Call the route handler
      await routeHandler(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Transformed HTML'));
    });
    
    it('should handle errors in development mode', async () => {
      // Arrange
      const vite = require('vite');
      const error = new Error('Vite error');
      
      vite.createServer.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(setupVite(app, server)).rejects.toThrow();
    });
  });
  
  describe('Production Mode', () => {
    beforeEach(() => {
      vi.doMock('../../server/config', () => ({
        ROOT_DIR: '/mockdir',
        CLIENT_OUT_DIR: '/mockdir/dist/client',
        NODE_ENV: 'production',
        IS_PRODUCTION: true
      }), { virtual: true });
      
      // Re-import to get updated config
      vi.resetModules();
    });
    
    it('should serve static files in production mode', async () => {
      // Re-import with mocked production config
      const { serveStatic } = require('../../server/vite');
      
      // Act
      serveStatic(app);
      
      // Assert
      expect(express.static).toHaveBeenCalled();
      expect(app.use).toHaveBeenCalledWith(expect.any(String), 'static-middleware');
    });
    
    it('should set up SSR in production mode', async () => {
      // Re-import with mocked production config
      const { setupVite } = require('../../server/vite');
      
      // Act
      await setupVite(app, server);
      
      // Assert
      expect(app.get).toHaveBeenCalledWith('*', expect.any(Function));
      expect(fs.promises.readFile).toHaveBeenCalled();
    });
    
    it('should handle SSR rendering in production mode', async () => {
      // Re-import with mocked production config
      const { setupVite } = require('../../server/vite');
      
      // Arrange
      const req = { url: '/' };
      const res = {
        status: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        end: vi.fn()
      };
      
      // Mock the GET route handler
      let routeHandler;
      app.get.mockImplementation((path, handler) => {
        if (path === '*') routeHandler = handler;
      });
      
      // Act
      await setupVite(app, server);
      
      // Ensure routeHandler was set
      expect(routeHandler).toBeDefined();
      
      // Call the route handler
      await routeHandler(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });
  });
  
  describe('Logging', () => {
    beforeEach(() => {
      console.log = vi.fn();
    });
    
    it('should log messages with source prefix', () => {
      // Act
      log('Test message', 'test-source');
      
      // Assert
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[test-source]'),
        'Test message'
      );
    });
    
    it('should use default source when not provided', () => {
      // Act
      log('Test message');
      
      // Assert
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[express]'),
        'Test message'
      );
    });
  });
});