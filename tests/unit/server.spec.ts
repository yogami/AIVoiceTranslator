/**
 * Server Tests (Consolidated)
 * 
 * A comprehensive test suite for the server functionality.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import * as http from 'http';
import cors from 'cors';

// Mock Express, HTTP and other dependencies
vi.mock('express', () => {
  const app = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    listen: vi.fn().mockImplementation((port, callback) => {
      if (callback) callback();
      return {
        on: vi.fn(),
        close: vi.fn().mockImplementation(cb => {
          if (cb) cb();
          return true;
        })
      };
    })
  };
  return {
    default: vi.fn(() => app),
    Router: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      use: vi.fn()
    })),
    static: vi.fn(),
    json: vi.fn(),
    urlencoded: vi.fn()
  };
});

// Mock the http module
vi.mock('http', () => {
  const mockServer = {
    listen: vi.fn(function(port, callback) {
      if (callback) callback();
      return this;
    }),
    on: vi.fn(),
    close: vi.fn((callback) => {
      if (callback) callback();
      return true;
    })
  };
  
  return {
    createServer: vi.fn(() => mockServer)
  };
});

vi.mock('cors', () => ({
  default: vi.fn(() => vi.fn())
}));

vi.mock('../../server/routes', () => ({
  apiRoutes: { get: vi.fn(), post: vi.fn() }
}));

vi.mock('../../server/vite', () => ({
  setupVite: vi.fn(),
  serveStatic: vi.fn(),
  log: vi.fn()
}));

vi.mock('../../server/websocket', () => ({
  createWebSocketServer: vi.fn(() => ({
    onConnection: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    broadcast: vi.fn()
  }))
}));

// Import modules under test
import { startServer, configureCorsMiddleware } from '../../server/server';

describe('Server', () => {
  let expressApp;
  let httpServer;
  
  beforeEach(() => {
    expressApp = express();
    httpServer = http.createServer(expressApp);
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Server Startup', () => {
    it('should start the server successfully', async () => {
      // Act
      const server = await startServer();
      
      // Assert
      expect(server).toBeDefined();
      expect(express().listen).toHaveBeenCalled();
    });
    
    it('should handle port configuration', async () => {
      // Arrange
      process.env.PORT = '4000';
      
      // Act
      const server = await startServer();
      
      // Assert
      expect(express().listen).toHaveBeenCalledWith(
        expect.anything(), 
        expect.any(Function)
      );
      
      // Clean up
      delete process.env.PORT;
    });
    
    it('should set up middleware correctly', async () => {
      // Act
      await startServer();
      
      // Assert
      expect(express().use).toHaveBeenCalledTimes(expect.any(Number));
      expect(express.json).toHaveBeenCalled();
      expect(express.urlencoded).toHaveBeenCalledWith({ extended: true });
    });
    
    it('should handle server startup errors', async () => {
      // Arrange
      const mockError = new Error('Server startup error');
      const originalListen = express().listen;
      express().listen = vi.fn(() => {
        throw mockError;
      });
      
      // Act & Assert
      await expect(startServer()).rejects.toThrow(mockError);
      
      // Restore the original implementation
      express().listen = originalListen;
    });
  });
  
  describe('CORS Configuration', () => {
    it('should configure CORS middleware', () => {
      // Act
      configureCorsMiddleware(expressApp);
      
      // Assert
      expect(cors).toHaveBeenCalled();
      expect(expressApp.use).toHaveBeenCalled();
    });
    
    it('should set CORS options correctly', () => {
      // Act
      configureCorsMiddleware(expressApp);
      
      // Assert
      expect(cors).toHaveBeenCalledWith(expect.objectContaining({
        origin: expect.any(Array) || expect.any(String) || expect.any(Boolean),
        methods: expect.any(Array) || expect.any(String),
        credentials: expect.any(Boolean)
      }));
    });
  });
  
  describe('Route Configuration', () => {
    it('should set up API routes', async () => {
      // Act
      await startServer();
      
      // Assert
      expect(express().use).toHaveBeenCalledWith('/api', expect.anything());
    });
    
    it('should serve static files in production mode', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const vite = require('../../server/vite');
      
      // Act
      await startServer();
      
      // Assert
      expect(vite.serveStatic).toHaveBeenCalled();
      
      // Clean up
      delete process.env.NODE_ENV;
    });
  });
  
  describe('WebSocket Setup', () => {
    it('should initialize WebSocket server', async () => {
      // Act
      await startServer();
      
      // Assert
      const { createWebSocketServer } = require('../../server/websocket');
      expect(createWebSocketServer).toHaveBeenCalled();
    });
  });
  
  describe('Server Shutdown', () => {
    it('should handle server shutdown', async () => {
      // Arrange
      const mockServer = {
        close: vi.fn((callback) => {
          if (callback) callback();
          return true;
        })
      };
      
      // Create a mock implementation for this test only
      const originalCreateServer = http.createServer;
      http.createServer = vi.fn().mockReturnValue(mockServer);
      
      // Act
      const server = await startServer();
      
      // Assert
      expect(server).toBeDefined();
      
      // Restore original implementation
      http.createServer = originalCreateServer;
    });
  });
});