/**
 * Server Entry Point Tests (Consolidated)
 * 
 * A comprehensive test suite for the server's main entry point functionality.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { Server } from 'http';

// Mock express and http
vi.mock('express', () => {
  const app = {
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn().mockImplementation((port, callback) => {
      if (callback) callback();
      return {
        on: vi.fn(),
        close: vi.fn()
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

vi.mock('../../server/routes', () => ({
  apiRoutes: { get: vi.fn(), post: vi.fn() }
}));

vi.mock('../../server/vite', () => ({
  setupVite: vi.fn(),
  serveStatic: vi.fn(),
  log: vi.fn()
}));

vi.mock('cors', () => ({
  default: vi.fn(() => vi.fn())
}));

vi.mock('../../server/websocket', () => ({
  createWebSocketServer: vi.fn(() => ({
    onConnection: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    broadcast: vi.fn()
  }))
}));

// Import the module under test
import { startServer } from '../../server/server';
import { configureCorsMiddleware } from '../../server/server';

describe('Server Entry Point', () => {
  let expressApp;
  
  beforeEach(() => {
    expressApp = express();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Server Initialization', () => {
    it('should start the server successfully', async () => {
      // Act
      const server = await startServer();
      
      // Assert
      expect(server).toBeDefined();
      expect(express().listen).toHaveBeenCalled();
    });
    
    it('should setup middleware correctly', async () => {
      // Act
      await startServer();
      
      // Assert
      expect(express().use).toHaveBeenCalled();
      // Middleware includes json parser
      expect(express.json).toHaveBeenCalled();
      // Middleware includes URL encoded parser
      expect(express.urlencoded).toHaveBeenCalled();
    });
    
    it('should set up API routes', async () => {
      // Act
      await startServer();
      
      // Assert
      expect(express().use).toHaveBeenCalledWith('/api', expect.anything());
    });
    
    it('should initialize WebSocket server', async () => {
      // Act
      await startServer();
      
      // Assert
      const { createWebSocketServer } = require('../../server/websocket');
      expect(createWebSocketServer).toHaveBeenCalled();
    });
  });
  
  describe('CORS Configuration', () => {
    it('should configure CORS middleware', () => {
      // Act
      configureCorsMiddleware(expressApp);
      
      // Assert
      const cors = require('cors').default;
      expect(cors).toHaveBeenCalled();
      expect(expressApp.use).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle server startup errors', async () => {
      // Arrange - Force an error on server listen
      const listenError = new Error('Port in use');
      express().listen.mockImplementationOnce((port, callback) => {
        throw listenError;
      });
      
      // Act & Assert
      await expect(startServer()).rejects.toThrow();
    });
  });
});