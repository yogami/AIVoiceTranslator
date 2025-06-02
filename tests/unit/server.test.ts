/**
 * Server Unit Tests
 *
 * Tests the startServer function behavior and contracts
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock http module
vi.mock('http', async (importOriginal) => {
  const actualHttp = await importOriginal() as any;
  const mockHttpServerInstance = {
    listen: vi.fn((port, cb) => {
      (mockHttpServerInstance as any).listeningPort = port;
      process.nextTick(() => {
        if (cb) cb();
      });
      return mockHttpServerInstance;
    }),
    on: vi.fn(),
    address: vi.fn(() => ({ port: (mockHttpServerInstance as any).listeningPort || 0 })),
    close: vi.fn((cb) => {
      process.nextTick(() => {
        if (cb) cb();
      });
    }),
    listening: false,
    clearMocks: () => {
        mockHttpServerInstance.listen.mockClear();
        mockHttpServerInstance.on.mockClear();
        mockHttpServerInstance.address.mockClear().mockReturnValue({ port: 0 });
        mockHttpServerInstance.close.mockClear();
        (mockHttpServerInstance as any).listeningPort = 0;
        mockHttpServerInstance.listening = false;
    }
  };
  const mockCreateServer = vi.fn(() => {
    mockHttpServerInstance.listening = false;
    const originalListen = mockHttpServerInstance.listen;
    mockHttpServerInstance.listen = vi.fn((port, cb) => {
      mockHttpServerInstance.listening = true;
      (mockHttpServerInstance as any).listeningPort = port;
      return originalListen(port, cb);
    });
    const originalClose = mockHttpServerInstance.close;
    mockHttpServerInstance.close = vi.fn((cb) => {
      mockHttpServerInstance.listening = false;
      return originalClose(cb);
    });
    return mockHttpServerInstance;
  });
  return {
    ...actualHttp,
    createServer: mockCreateServer,
    _mockHttpServerInstance: mockHttpServerInstance,
    _mockCreateServer: mockCreateServer,
    Server: actualHttp.Server,
  };
});

// Declare a variable to hold the mock constructor for WebSocketServer
// let webSocketServerMockConstructor: any; // No longer needed here

// Mock WebSocketServer before importing server
vi.mock('../../server/services/WebSocketServer', () => {
  const localMockConstructor = vi.fn();
  return {
    WebSocketServer: localMockConstructor,
    // Provide a getter to access the same instance of the mock constructor
    _webSocketServerMockConstructorGetter: () => localMockConstructor 
  };
}); 

// Now import the server module AFTER mocks are set up
import { startServer, configureCorsMiddleware } from '../../server/server';
import * as http from 'http'; // Import the mocked http to access its members
// Import the mocked WebSocketServer service to access the getter
import * as WSService from '../../server/services/WebSocketServer'; 

// Helper to access the exposed mock instance from the mocked http module
const getMockedHttpServerInstance = () => (http as any)._mockHttpServerInstance;
const getMockedCreateServer = () => (http as any)._mockCreateServer;
// Helper to access the WebSocketServer mock constructor
const getWebSocketServerMockConstructor = () => (WSService as any)._webSocketServerMockConstructorGetter();

describe('Server Unit Tests', () => {
  let server: any;
  
  beforeEach(() => {
    vi.clearAllMocks(); 
    
    const mockedHttpInstance = getMockedHttpServerInstance();
    if (mockedHttpInstance && typeof mockedHttpInstance.clearMocks === 'function') {
        mockedHttpInstance.clearMocks();
    } else if (mockedHttpInstance) { 
        mockedHttpInstance.listen.mockClear();
        mockedHttpInstance.on.mockClear();
        mockedHttpInstance.address.mockClear().mockReturnValue({ port: 0 });
        mockedHttpInstance.close.mockClear();
        (mockedHttpInstance as any).listeningPort = 0;
        mockedHttpInstance.listening = false;
    }

    // Set up the mock implementation for WebSocketServer using the getter
    getWebSocketServerMockConstructor().mockImplementation(() => ({
      getConnections: vi.fn(() => new Set()),
      getRole: vi.fn(),
      getLanguage: vi.fn(),
      close: vi.fn()
    }));
    
    process.env.NODE_ENV = 'test';
  });
  
  afterEach(async () => {
    const mockedHttpInstance = getMockedHttpServerInstance();
    if (server?.httpServer?.listening) {
      await new Promise<void>((resolve) => {
        if (server.httpServer === mockedHttpInstance) {
          mockedHttpInstance.close(resolve);
        } else {
          server.httpServer.close(resolve);
        }
      });
    }
    server = null;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    vi.restoreAllMocks();
  });

  describe('startServer', () => {
    it('should return app, httpServer, and wss properties', async () => {
      server = await startServer();
      expect(server).toBeDefined();
      expect(server).toHaveProperty('app');
      expect(server).toHaveProperty('httpServer');
      expect(server).toHaveProperty('wss');
      expect(server.app).toBeInstanceOf(Function);
      expect(server.httpServer).toBe(getMockedHttpServerInstance()); 
    });

    it('should create a WebSocketServer instance', async () => { 
      const mockInstance = { close: vi.fn() };
      // Use the getter for the mock constructor variable here
      getWebSocketServerMockConstructor().mockImplementation(() => mockInstance);
      server = await startServer();
      // And here for assertions
      expect(getWebSocketServerMockConstructor()).toHaveBeenCalledTimes(1);
      expect(getWebSocketServerMockConstructor()).toHaveBeenCalledWith(getMockedHttpServerInstance());
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
      const mockedHttpInstance = getMockedHttpServerInstance();
      mockedHttpInstance.address.mockImplementation(() => ({ port: 12345 }));
      const testServer: any = await startServer();
      expect(testServer.httpServer.listening).toBe(true);
      const address = testServer.httpServer.address();
      expect(address.port).toBe(12345);
    });

    it('should default to port 5000 if NODE_ENV is not \'test\' and PORT is not set', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockedHttpInstance = getMockedHttpServerInstance();
      const mockedCreateServerSpy = getMockedCreateServer();

      try {
        process.env.NODE_ENV = 'development';
        delete process.env.PORT;
        mockedHttpInstance.address.mockImplementation(() => {
            return { port: mockedHttpInstance.listeningPort === 5000 ? 5000 : 0 };
        });
        server = await startServer();
        expect(mockedHttpInstance.listen).toHaveBeenCalledWith(5000, expect.any(Function));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[express] serving on port 5000'));
      } finally {
        consoleLogSpy.mockRestore();
        process.env.NODE_ENV = originalNodeEnv;
        if (originalPort !== undefined) process.env.PORT = originalPort; else delete process.env.PORT;
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
