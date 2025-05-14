/**
 * WebSocket Module Tests
 * 
 * These tests verify the functionality of the WebSocketService and related utilities.
 * Coverage targets: 90% for lines, functions, and statements; 85% for branches
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { Socket } from 'net';

// Spy on console methods
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Mock WebSocket
vi.mock('ws', () => {
  // Create a mock client for use in tests
  const MockClient = vi.fn().mockImplementation((options = {}) => {
    const defaultProps = {
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      ping: vi.fn(),
      terminate: vi.fn(),
      isAlive: true,
      readyState: 1, // OPEN by default
      role: undefined,
      languageCode: undefined,
      sessionId: undefined
    };

    return {
      ...defaultProps,
      ...options
    };
  });

  // Create a mock server
  const MockWebSocketServer = vi.fn().mockImplementation(() => {
    const clients = new Set();
    // Create two clients with different roles
    clients.add(new MockClient({ role: 'teacher', readyState: 1 }));
    clients.add(new MockClient({ role: 'student', readyState: 1 }));
    // Add a closed client
    clients.add(new MockClient({ role: 'student', readyState: 3 }));
    
    return {
      on: vi.fn(),
      clients,
      close: vi.fn()
    };
  });

  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: {
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      CONNECTING: 0
    }
  };
});

// Mock http module
vi.mock('http', () => {
  const MockServer = vi.fn().mockImplementation(() => ({
    on: vi.fn()
  }));
  
  const MockIncomingMessage = vi.fn().mockImplementation(() => ({
    headers: {
      'sec-websocket-key': 'test-key'
    },
    url: '/ws',
    socket: {
      remoteAddress: '127.0.0.1'
    }
  }));

  return {
    Server: MockServer,
    IncomingMessage: MockIncomingMessage,
    createServer: vi.fn().mockReturnValue({
      listen: vi.fn()
    })
  };
});

// Use Vi's mock timers instead of mocking the timer modules
beforeEach(() => {
  vi.useFakeTimers();
});

describe('WebSocket Module', () => {
  let mockServer;

  beforeEach(() => {
    // Create a mock HTTP server
    mockServer = new Server();
    
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('WebSocketService class', () => {
    it('should create a WebSocketService instance with default config', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      
      // The test passes if the constructor doesn't throw
      expect(wsService).toBeDefined();
      // @ts-ignore - accessing private property for testing
      expect(wsService['config'].path).toBe('/ws'); // Default path
      // @ts-ignore - accessing private property for testing
      expect(wsService['config'].heartbeatInterval).toBe(30000); // Default interval
    });

    it('should create a WebSocketService instance with custom config', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer, { 
        path: '/test-ws',
        heartbeatInterval: 10000,
        logLevel: 'debug'
      });
      
      // @ts-ignore - accessing private property for testing
      expect(wsService['config'].path).toBe('/test-ws');
      // @ts-ignore - accessing private property for testing
      expect(wsService['config'].heartbeatInterval).toBe(10000);
      // @ts-ignore - accessing private property for testing
      expect(wsService['config'].logLevel).toBe('debug');
    });

    it('should register message handlers correctly', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      
      // Register a message handler
      const mockHandler = vi.fn();
      wsService.onMessage('test-message', mockHandler);
      
      // Use private method access pattern to test the handler was registered
      // @ts-ignore - accessing private property for testing
      expect(wsService['messageHandlers'].has('test-message')).toBe(true);

      // Register another handler for the same message type
      const mockHandler2 = vi.fn();
      wsService.onMessage('test-message', mockHandler2);
      
      // @ts-ignore - accessing private property for testing
      expect(wsService['messageHandlers'].get('test-message').length).toBe(2);
    });

    it('should register connection handlers correctly', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      
      // Register a connection handler
      const mockHandler = vi.fn();
      wsService.onConnection(mockHandler);
      
      // @ts-ignore - accessing private property for testing
      expect(wsService['connectionHandlers'].length).toBe(1);
    });

    it('should register close handlers correctly', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      
      // Register a close handler
      const mockHandler = vi.fn();
      wsService.onClose(mockHandler);
      
      // @ts-ignore - accessing private property for testing
      expect(wsService['closeHandlers'].length).toBe(1);
    });

    it('should broadcast messages to all clients in OPEN state', async () => {
      const { WebSocketService, WebSocketState } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      const clients = Array.from(wsService.getClients());
      
      const message = { type: 'test', data: 'test-data' };
      wsService.broadcast(message);
      
      // Only clients in OPEN state should receive messages
      const openClients = clients.filter(client => client.readyState === WebSocketState.OPEN);
      openClients.forEach(client => {
        expect(client.send).toHaveBeenCalledWith(JSON.stringify(message));
      });
      
      // Count the number of calls to send
      const sendCallCount = clients.reduce((count, client) => {
        return count + (client.send as any).mock.calls.length;
      }, 0);
      
      // There should be exactly 2 open clients (teacher and student)
      expect(sendCallCount).toBe(2);
    });

    it('should broadcast messages to clients with a specific role', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      const clients = Array.from(wsService.getClients());
      
      const message = { type: 'teacher-message', data: 'for teachers only' };
      wsService.broadcastToRole('teacher', message);
      
      // Find all teacher clients
      const teacherClients = clients.filter(client => (client as any).role === 'teacher' && client.readyState === 1);
      teacherClients.forEach(client => {
        expect(client.send).toHaveBeenCalledWith(JSON.stringify(message));
      });
      
      // Student clients should not receive the message
      const studentClients = clients.filter(client => (client as any).role === 'student');
      studentClients.forEach(client => {
        if (client.readyState === 1) {
          expect(client.send).not.toHaveBeenCalledWith(JSON.stringify(message));
        }
      });
    });

    it('should get clients with a specific role', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      
      // Get clients by role
      const teacherClients = wsService.getClientsByRole('teacher');
      const studentClients = wsService.getClientsByRole('student');
      
      // Should find 1 teacher and 2 students (one open, one closed)
      expect(teacherClients.length).toBe(1);
      expect(studentClients.length).toBe(2);
      
      // Verify each client has the correct role
      teacherClients.forEach(client => {
        expect(client.role).toBe('teacher');
      });
      
      studentClients.forEach(client => {
        expect(client.role).toBe('student');
      });
    });

    it('should not send messages to clients not in OPEN state', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      
      // Get a client that is not in OPEN state
      const clients = Array.from(wsService.getClients());
      const closedClient = clients.find(client => client.readyState !== 1);
      
      // Send a message to the closed client
      const message = { type: 'test', data: 'test-data' };
      wsService.sendToClient(closedClient as any, message);
      
      // Verify send was not called
      expect(closedClient!.send).not.toHaveBeenCalled();
    });

    it('should setup and use heartbeat mechanism', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      const { setInterval } = await import('timers');
      
      const wsService = new WebSocketService(mockServer, { 
        heartbeatInterval: 5000 
      });
      
      // Verify setInterval was called with the correct interval
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
      
      // @ts-ignore - accessing private property for testing
      const heartbeatInterval = wsService['heartbeatInterval'];
      expect(heartbeatInterval).toBeDefined();
      
      // Simulate heartbeat execution by calling the callback directly
      // @ts-ignore - get the first argument (callback function) from the first call
      const heartbeatCallback = (setInterval as any).mock.calls[0][0];
      heartbeatCallback();
      
      // Verify ping was called on each client
      const clients = Array.from(wsService.getClients());
      clients.forEach(client => {
        expect(client.ping).toHaveBeenCalled();
      });
    });

    it('should terminate inactive clients during heartbeat', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      const { setInterval } = await import('timers');
      
      const wsService = new WebSocketService(mockServer);
      
      // Get all clients and mark one as inactive
      const clients = Array.from(wsService.getClients());
      (clients[0] as any).isAlive = false;
      
      // @ts-ignore - get the first argument (callback function) from the first call
      const heartbeatCallback = (setInterval as any).mock.calls[0][0];
      heartbeatCallback();
      
      // The inactive client should be terminated
      expect(clients[0].terminate).toHaveBeenCalled();
    });

    it('should clean up resources when closed', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      const { clearInterval } = await import('timers');
      
      const wsService = new WebSocketService(mockServer);
      
      // @ts-ignore - accessing private property for testing
      wsService['cleanup']();
      
      // Verify clearInterval was called
      expect(clearInterval).toHaveBeenCalled();
      
      // @ts-ignore - accessing private property for testing
      expect(wsService['heartbeatInterval']).toBeNull();
    });

    it('should expose the WebSocket server through getServer', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      const server = wsService.getServer();
      
      expect(server).toBeDefined();
      // @ts-ignore - accessing private property for testing
      expect(server).toBe(wsService['wss']);
    });

    it('should get all clients through getClients', async () => {
      const { WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      const clients = wsService.getClients();
      
      expect(clients).toBeDefined();
      expect(clients.size).toBe(3); // Should have 3 mock clients
    });

    it('should respect configured log level', async () => {
      console.log = vi.fn();
      console.warn = vi.fn();
      console.error = vi.fn();
      
      const { WebSocketService } = await import('../../server/websocket');
      
      // Create a service with error-only logging
      const wsService = new WebSocketService(mockServer, {
        logLevel: 'error'
      });
      
      // @ts-ignore - access private log method
      wsService['log']('debug', 'Debug message');
      // @ts-ignore - access private log method
      wsService['log']('info', 'Info message');
      // @ts-ignore - access private log method
      wsService['log']('warn', 'Warning message');
      // @ts-ignore - access private log method
      wsService['log']('error', 'Error message');
      
      // Only error should be logged
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error message');
    });
  });

  describe('Helper functions', () => {
    it('should create a WebSocketServer with the factory function', async () => {
      const { createWebSocketServer } = await import('../../server/websocket');
      
      const wsServer = createWebSocketServer(mockServer, '/test-path');
      
      expect(wsServer).toBeDefined();
      // @ts-ignore - accessing private property for testing
      expect(wsServer['config'].path).toBe('/test-path');
    });

    it('should broadcast messages with the broadcast function to WebSocketService', async () => {
      const { broadcastMessage, WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      const broadcastSpy = vi.spyOn(wsService, 'broadcast');
      
      // Call the standalone broadcast function with WebSocketService instance
      broadcastMessage(wsService, { type: 'test' });
      
      // Verify broadcast was called on the service
      expect(broadcastSpy).toHaveBeenCalledWith({ type: 'test' });
    });

    it('should broadcast messages with the broadcast function to WSServer', async () => {
      const { broadcastMessage, WebSocketService } = await import('../../server/websocket');
      
      const wsService = new WebSocketService(mockServer);
      // @ts-ignore - accessing private property for testing
      const wss = wsService['wss'];
      
      // Call the standalone broadcast function with raw WSServer
      broadcastMessage(wss, { type: 'test' });
      
      // Verify clients received the message
      const clients = Array.from(wss.clients).filter(c => c.readyState === 1);
      clients.forEach(client => {
        expect(client.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test' }));
      });
    });

    it('should send messages to a client when client is in OPEN state', async () => {
      const { sendToClient, WebSocketState } = await import('../../server/websocket');
      
      // Create a mock client in OPEN state
      const mockClient = {
        send: vi.fn(),
        readyState: WebSocketState.OPEN
      };
      
      // Send a message
      sendToClient(mockClient as any, { type: 'test' });
      
      // Check if send was called
      expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test' }));
    });

    it('should not send messages to a client when client is not in OPEN state', async () => {
      const { sendToClient, WebSocketState } = await import('../../server/websocket');
      
      // Create a mock client not in OPEN state
      const mockClient = {
        send: vi.fn(),
        readyState: WebSocketState.CLOSED
      };
      
      // Send a message
      sendToClient(mockClient as any, { type: 'test' });
      
      // Check if send was not called
      expect(mockClient.send).not.toHaveBeenCalled();
    });
  });
});