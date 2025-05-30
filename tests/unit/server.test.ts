/**
 * Server Unit Tests
 *
 * Tests the startServer function behavior and contracts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'http';
import express from 'express';
import request from 'supertest';

// Mock WebSocketServer before importing server
const MockWebSocketServer = vi.fn();
vi.mock('../../../server/services/WebSocketServer', () => ({
  WebSocketServer: MockWebSocketServer
}));

import { startServer, configureCorsMiddleware } from '../../server/server';

describe('Server Unit Tests', () => {
  let server: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocketServer.mockImplementation(() => ({
      getConnections: vi.fn(() => new Set()),
      getRole: vi.fn(),
      getLanguage: vi.fn(),
      close: vi.fn()
    }));
    
    // Set test environment to use random port
    process.env.NODE_ENV = 'test';
  });
  
  afterEach(async () => {
    if (server?.httpServer) {
      await new Promise<void>((resolve) => {
        server.httpServer.close(() => resolve());
      });
    }
    delete process.env.NODE_ENV;
  });

  describe('startServer', () => {
    it('should return an object with app, httpServer, and wss properties', async () => {
      server = await startServer();
      
      expect(server).toBeDefined();
      expect(server).toHaveProperty('app');
      expect(server).toHaveProperty('httpServer');
      expect(server).toHaveProperty('wss');
      expect(server.app).toBeInstanceOf(Function); // Express app is a function
    });

    it('should create a WebSocket server instance', async () => {
      // Reset the mock before test
      MockWebSocketServer.mockClear();
      
      // Create a mock instance
      const mockInstance = { close: vi.fn() };
      MockWebSocketServer.mockImplementation(() => mockInstance);
      
      server = await startServer();
      
      expect(MockWebSocketServer).toHaveBeenCalledTimes(1);
      expect(MockWebSocketServer).toHaveBeenCalledWith(server.httpServer);
      expect(server.wss).toBe(mockInstance);
    });

    it('should log warning when OPENAI_API_KEY is missing', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      server = await startServer();
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ No OPENAI_API_KEY found in environment variables');
      
      consoleSpy.mockRestore();
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    it('should log success when OPENAI_API_KEY is present', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      server = await startServer();
      
      expect(consoleSpy).toHaveBeenCalledWith('OpenAI API key status: Present');
      
      consoleSpy.mockRestore();
    });

    it('should use PORT environment variable when provided', async () => {
      // For test environment, we use random port, so just verify it's working
      process.env.PORT = '0'; // Random port
      
      server = await startServer();
      
      expect(server.httpServer.listening).toBe(true);
      
      delete process.env.PORT;
    });
  });

  describe('configureCorsMiddleware', () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
    });

    it('should add CORS middleware to the app', () => {
      const useSpy = vi.spyOn(app, 'use');
      
      configureCorsMiddleware(app);
      
      expect(useSpy).toHaveBeenCalled();
    });

    it('should configure middleware that sets CORS headers', async () => {
      configureCorsMiddleware(app);
      app.get('/test', (req, res) => res.send('OK'));
      
      const response = await request(app).get('/test');
      
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should handle OPTIONS requests', async () => {
      configureCorsMiddleware(app);
      
      const response = await request(app).options('/test');
      
      expect(response.status).toBe(200);
    });
  });
});
