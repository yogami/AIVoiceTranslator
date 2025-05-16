/**
 * Server Entry Point Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all the dependencies
vi.mock('express', () => {
  return {
    __esModule: true,
    default: vi.fn().mockReturnValue({
      use: vi.fn(),
      get: vi.fn(),
      listen: vi.fn().mockReturnValue({
        on: vi.fn(),
        close: vi.fn()
      })
    }),
    json: vi.fn(),
    urlencoded: vi.fn(),
    static: vi.fn(),
    Router: vi.fn().mockReturnValue({})
  };
});

vi.mock('cors', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue(vi.fn())
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
  createWebSocketServer: vi.fn().mockReturnValue({
    onConnection: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn()
  })
}));

// Import modules AFTER mocking
import { startServer, configureCorsMiddleware } from '../../server/server';
import express from 'express';

describe('Server Entry Point', () => {
  let expressApp;
  
  beforeEach(() => {
    expressApp = express();
    vi.clearAllMocks();
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
      // Import cors directly
      import('cors').then(corsModule => {
        // Act
        configureCorsMiddleware(expressApp);
        
        // Assert
        expect(expressApp.use).toHaveBeenCalled();
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle server startup errors', async () => {
      // Arrange - Create a failing server scenario
      const mockExpressApp = express();
      
      // Create a spy that will throw an error
      const listenSpy = vi.spyOn(mockExpressApp, 'listen').mockImplementation(() => {
        throw new Error('Server startup error');
      });
      
      // Mock express to return our controlled app
      vi.mocked(express).mockReturnValueOnce(mockExpressApp);
      
      // Act & Assert
      await expect(startServer()).rejects.toThrow();
      
      // Cleanup
      listenSpy.mockRestore();
    });
  });
});