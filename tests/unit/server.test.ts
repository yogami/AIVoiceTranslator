/**
 * Server Unit Tests
 *
 * Tests the startServer function behavior and contracts
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest';
import { Server as HttpServer } from 'http';
import express from 'express';
import request from 'supertest';

// Mock WebSocketServer before importing server
const MockWebSocketServer = vi.fn();
vi.mock('../../../server/services/WebSocketServer', () => ({
  WebSocketServer: MockWebSocketServer
}));

import { startServer, configureCorsMiddleware } from '../../server/server';

describe('Server Unit Tests', () => {
  let server: any; // Use any for simplicity for the global server ref
  
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
    if (server?.httpServer?.listening) {
      await new Promise<void>((resolve) => {
        server.httpServer.close(() => resolve());
      });
    }
    server = null;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    vi.restoreAllMocks(); // Ensure all spies are restored
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
      
      expect(consoleSpy).toHaveBeenCalledWith('OpenAI API key found and client configured.');
      
      consoleSpy.mockRestore();
    });

    it('should use PORT environment variable or default for tests', async () => {
      delete process.env.PORT;
      const testServer: any = await startServer();
      expect(testServer.httpServer.listening).toBe(true);
      const address = testServer.httpServer.address();
      if (typeof address === 'object' && address !== null) {
        expect(address.port).not.toBe(5000);
      }
      if (testServer.httpServer.listening) {
        await new Promise<void>(resolve => testServer.httpServer.close(resolve));
      }
    });

    it('should default to port 5000 if NODE_ENV is not \'test\' and PORT is not set', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      let localTestServerInstance: any = null; 

      let createServerSpy: any = undefined; // Initialize to undefined, use any type
      let consoleLogSpy: any = undefined;   // Initialize to undefined, use any type
      let listenSpy: any;                 // Will be vi.fn()

      try {
        process.env.NODE_ENV = 'development';
        delete process.env.PORT;

        listenSpy = vi.fn().mockImplementation((port: number, cb_listen?: () => void) => { 
          if (cb_listen) cb_listen(); 
          return { 
            close: (cb_close?: () => void) => { if (cb_close) cb_close(); },
            on: vi.fn(),
            address: () => ({ port: 5000 }) 
          };
        });
        
        const mockHttpServerCtrl = { 
          listen: listenSpy, 
          on: vi.fn(), 
          address: () => ({ port: 5000 }) 
        };

        const httpModule = await import('http');
        createServerSpy = vi.spyOn(httpModule, 'createServer').mockReturnValue(mockHttpServerCtrl as any);
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        localTestServerInstance = await startServer();

        expect(listenSpy).toHaveBeenCalledWith(5000, expect.any(Function));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[express] serving on port 5000'));
        
      } finally {
        if (createServerSpy) createServerSpy.mockRestore(); // Check if spy exists before restoring
        if (consoleLogSpy) consoleLogSpy.mockRestore();   // Check if spy exists before restoring
        
        process.env.NODE_ENV = originalNodeEnv;
        if (originalPort !== undefined) process.env.PORT = originalPort; else delete process.env.PORT;
        if (localTestServerInstance?.httpServer?.listening) {
          await new Promise<void>(resolve => localTestServerInstance.httpServer.close(resolve));
        }
      }
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
