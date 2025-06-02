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
    it('should return app, httpServer, and wss properties', async () => {
      server = await startServer();
      
      expect(server).toBeDefined();
      expect(server).toHaveProperty('app');
      expect(server).toHaveProperty('httpServer');
      expect(server).toHaveProperty('wss');
      expect(server.app).toBeInstanceOf(Function); // Express app is a function
    });

    it('should create a WebSocketServer instance', async () => {
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

    it('should log warning if OPENAI_API_KEY is missing', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      server = await startServer();
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ No OPENAI_API_KEY found in environment variables');
      
      consoleSpy.mockRestore();
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    it('should log success if OPENAI_API_KEY is present', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      server = await startServer();
      
      expect(consoleSpy).toHaveBeenCalledWith('OpenAI API key status: Present');
      
      consoleSpy.mockRestore();
    });

    it('should use PORT environment variable or default for tests', async () => {
      process.env.PORT = '0'; 
      server = await startServer();
      expect(server.httpServer.listening).toBe(true);
      delete process.env.PORT;
    });

    it('should default to port 5000 if NODE_ENV is not \'test\' and PORT is not set', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      
      process.env.NODE_ENV = 'development';
      delete process.env.PORT;

      const listenSpy = vi.fn().mockImplementation((port: number, cb: () => void) => { 
        const mockServerInstance = { close: (closeCb?: () => void) => { if(closeCb) closeCb(); } };
        if (cb) cb(); 
        return mockServerInstance;
      });
      
      const httpServerInstance = { 
        listen: listenSpy, 
        on: vi.fn(), 
        address: () => ({ port: 5000 }) 
      };
      const httpModule = await import('http'); // Import http for spyOn
      const createServerSpy = vi.spyOn(httpModule, 'createServer').mockReturnValue(httpServerInstance as any);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      server = await startServer();

      expect(listenSpy).toHaveBeenCalledWith(5000, expect.any(Function));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[express] serving on port 5000'));

      createServerSpy.mockRestore();
      consoleLogSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
      if (originalPort) process.env.PORT = originalPort; else delete process.env.PORT;
    });
  });

  describe('configureCorsMiddleware', () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
    });

    it('should add CORS middleware', () => {
      const useSpy = vi.spyOn(app, 'use');
      
      configureCorsMiddleware(app);
      
      expect(useSpy).toHaveBeenCalled();
    });

    it('should set CORS headers correctly', async () => {
      configureCorsMiddleware(app);
      app.get('/test', (req, res) => res.send('OK'));
      
      const response = await request(app).get('/test');
      
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should handle OPTIONS preflight requests', async () => {
      configureCorsMiddleware(app);
      
      const response = await request(app).options('/test');
      
      expect(response.status).toBe(200);
    });
  });
});
