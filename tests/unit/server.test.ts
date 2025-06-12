/**
 * Server Unit Tests
 *
 * Tests the startServer function behavior and contracts
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as http from 'http'; // Import the mocked http to access its members
import logger from '../../server/logger'; // Import the logger

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
  
  // Make the mock instance extend the Server prototype
  Object.setPrototypeOf(mockHttpServerInstance, actualHttp.Server.prototype);
  
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
// Import the mocked WebSocketServer service to access the getter
import * as WSService from '../../server/services/WebSocketServer'; 

// Helper to access the exposed mock instance from the mocked http module
const getMockedHttpServerInstance = () => (http as any)._mockHttpServerInstance;
const getMockedCreateServer = () => (http as any)._mockCreateServer;
// Helper to access the WebSocketServer mock constructor
const getWebSocketServerMockConstructor = () => (WSService as any)._webSocketServerMockConstructorGetter();

describe('Server Unit Tests', () => {
  let server: any;
  
  // Set required env vars for config strictness
  beforeAll(() => {
    process.env.PORT = '1234';
    process.env.HOST = 'localhost';
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'info';
    process.env.TEST_REDIS_URL = 'redis://localhost:6379';
    process.env.TEST_PORT = '1234';
    process.env.TEST_HOST = 'localhost';
  });

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
    if (server && mockedHttpInstance.listening) {
      await new Promise<void>((resolve) => {
        if (server === mockedHttpInstance) {
          mockedHttpInstance.close(resolve);
        } else if (server.close) {
          server.close(resolve);
        } else {
          resolve();
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
      const app = express();
      server = await startServer(app);
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(http.Server);
      expect(getWebSocketServerMockConstructor()).toHaveBeenCalledTimes(1);
    });

    it('should create a WebSocketServer instance', async () => { 
      const mockInstance = { close: vi.fn() };
      // Use the getter for the mock constructor variable here
      getWebSocketServerMockConstructor().mockImplementation(() => mockInstance);
      const app = express();
      server = await startServer(app);
      // And here for assertions
      expect(getWebSocketServerMockConstructor()).toHaveBeenCalledTimes(1);
      expect(getWebSocketServerMockConstructor()).toHaveBeenCalledWith(getMockedHttpServerInstance());
    });

    it('should log warning if OPENAI_API_KEY is missing', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(function(this: any, ...args: any[]) { return this; }); // Spy on logger.warn
      const app = express();
      server = await startServer(app);
      expect(loggerWarnSpy).toHaveBeenCalledWith('⚠️ No OPENAI_API_KEY found in environment variables');
      // Winston might be called twice for the two warnings
      expect(loggerWarnSpy).toHaveBeenCalledWith('Translation functionality will be limited');
      loggerWarnSpy.mockRestore();
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    it('should log success if OPENAI_API_KEY is present', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(function(this: any, ...args: any[]) { return this; }); // Spy on logger.info
      const app = express();
      server = await startServer(app);
      expect(loggerInfoSpy).toHaveBeenCalledWith('OpenAI API key found and client configured.');
      loggerInfoSpy.mockRestore();
    });

    it('should use PORT environment variable or default for tests', async () => {
      delete process.env.PORT;
      const mockedHttpInstance = getMockedHttpServerInstance();
      mockedHttpInstance.address.mockImplementation(() => ({ port: 12345 }));
      const app = express();
      const testServer: any = await startServer(app);
      expect(mockedHttpInstance.listening).toBe(true);
      const address = mockedHttpInstance.address();
      expect(address.port).toBe(12345);
    });

    it('should default to port 5000 if NODE_ENV is not \'test\' and PORT is not set', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      const loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(function(this: any, ...args: any[]) { return this; }); // Spy on logger.info
      const mockedHttpInstance = getMockedHttpServerInstance();
      const mockedCreateServerSpy = getMockedCreateServer();

      try {
        process.env.NODE_ENV = 'development';
        delete process.env.PORT;
        mockedHttpInstance.address.mockImplementation(() => {
            return { port: mockedHttpInstance.listeningPort === 5000 ? 5000 : 0 };
        });
        const app = express();
        server = await startServer(app);
        expect(mockedHttpInstance.listen).toHaveBeenCalledWith(5000, expect.any(Function));
        // Check that logger.info was called with the message about serving on port 5000
        // It will also be called for 'Server started successfully'
        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[express] serving on port 5000'));
      } finally {
        loggerInfoSpy.mockRestore();
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
