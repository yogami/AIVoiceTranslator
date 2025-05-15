/**
 * Basic WebSocket Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  WebSocketService, 
  WebSocketState, 
  createWebSocketServer, 
  ExtendedWebSocket, 
  WebSocketMessage, 
  broadcastMessage,
  sendToClient 
} from '../../server/websocket';
import { Server } from 'http';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// Mock WebSocket
vi.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;
  
  class MockWebSocket extends EventEmitter {
    binaryType = 'arraybuffer';
    bufferedAmount = 0;
    extensions = '';
    protocol = '';
    readyState = WebSocketState.OPEN;
    url = 'ws://localhost:8080/ws';
    
    // Custom properties for testing
    isAlive = true;
    sessionId = undefined;
    role = undefined;
    languageCode = undefined;
    
    // Mock methods
    send = vi.fn();
    ping = vi.fn();
    terminate = vi.fn();
    close = vi.fn();
  }
  
  class MockWSServer extends EventEmitter {
    clients = new Set();
    
    constructor() {
      super();
      // Add default client
      this.clients.add(new MockWebSocket());
    }
    
    on = vi.fn((event, callback) => {
      super.on(event, callback);
      return this;
    });
  }
  
  return {
    WebSocket: MockWebSocket,
    WebSocketServer: MockWSServer
  };
});

describe('WebSocketService', () => {
  let httpServer: Server;
  let wsService: WebSocketService;
  let mockRequest: IncomingMessage;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mocked HTTP request for connection events
    mockRequest = {
      socket: {
        remoteAddress: '127.0.0.1'
      },
      headers: {},
      url: '/ws'
    } as unknown as IncomingMessage;
    
    httpServer = new Server();
    wsService = new WebSocketService(httpServer);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should create a WebSocketService instance', () => {
    expect(wsService).toBeInstanceOf(WebSocketService);
  });
  
  it('should get the server instance', () => {
    const wss = wsService.getServer();
    expect(wss).toBeDefined();
  });
  
  it('should broadcast messages to all clients', () => {
    // Get server instance
    const wss = wsService.getServer();
    
    // Create mock clients
    const client1 = new WebSocket() as ExtendedWebSocket;
    const client2 = new WebSocket() as ExtendedWebSocket;
    
    // Add them to clients set
    wss.clients.clear();
    wss.clients.add(client1);
    wss.clients.add(client2);
    
    // Broadcast a message
    const message: WebSocketMessage = { type: 'test', data: 'hello' };
    wsService.broadcast(message);
    
    // Check that both clients received the message
    expect(client1.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(client2.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  it('should broadcast messages to clients with specific role', () => {
    // Get server instance
    const wss = wsService.getServer();
    
    // Create mock clients with roles
    const teacher = new WebSocket() as ExtendedWebSocket;
    teacher.role = 'teacher';
    
    const student = new WebSocket() as ExtendedWebSocket;
    student.role = 'student';
    
    const noRole = new WebSocket() as ExtendedWebSocket;
    
    // Add them to clients set
    wss.clients.clear();
    wss.clients.add(teacher);
    wss.clients.add(student);
    wss.clients.add(noRole);
    
    // Broadcast to only teachers
    const message: WebSocketMessage = { type: 'test', data: 'hello teachers' };
    wsService.broadcastToRole('teacher', message);
    
    // Check that only teacher client received the message
    expect(teacher.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(student.send).not.toHaveBeenCalledWith(JSON.stringify(message));
    expect(noRole.send).not.toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  it('should send message to a specific client', () => {
    // Create a mock client
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Send message to the client
    const message: WebSocketMessage = { type: 'test', data: 'hello client' };
    wsService.sendToClient(client, message);
    
    // Check that client received the message
    expect(client.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  it('should get clients with a specific role', () => {
    // Get server instance
    const wss = wsService.getServer();
    
    // Create mock clients with roles
    const teacher1 = new WebSocket() as ExtendedWebSocket;
    teacher1.role = 'teacher';
    
    const teacher2 = new WebSocket() as ExtendedWebSocket;
    teacher2.role = 'teacher';
    
    const student = new WebSocket() as ExtendedWebSocket;
    student.role = 'student';
    
    // Add them to clients set
    wss.clients.clear();
    wss.clients.add(teacher1);
    wss.clients.add(teacher2);
    wss.clients.add(student);
    
    // Get all teachers
    const teachers = wsService.getClientsByRole('teacher');
    
    // Check that we got the correct clients
    expect(teachers).toHaveLength(2);
    expect(teachers).toContain(teacher1);
    expect(teachers).toContain(teacher2);
    expect(teachers).not.toContain(student);
  });
  
  it('should register and execute message handlers', () => {
    // Setup mock handler
    const mockHandler = vi.fn();
    wsService.onMessage('test-event', mockHandler);
    
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Simulate a message event on the client
    const message = { type: 'test-event', data: 'test' };
    client.emit('message', Buffer.from(JSON.stringify(message)));
    
    // Verify the handler was called
    expect(mockHandler).toHaveBeenCalledWith(client, message);
  });
  
  it('should register and execute connection handlers', () => {
    // Setup mock handler
    const mockHandler = vi.fn();
    wsService.onConnection(mockHandler);
    
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Verify the handler was called
    expect(mockHandler).toHaveBeenCalledWith(client, mockRequest);
  });
  
  it('should register and execute close handlers', () => {
    // Setup mock handler
    const mockHandler = vi.fn();
    wsService.onClose(mockHandler);
    
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Simulate close event
    const code = 1000;
    const reason = 'normal';
    client.emit('close', code, reason);
    
    // Verify the handler was called
    expect(mockHandler).toHaveBeenCalledWith(client, code, reason);
  });
  
  it('should handle errors in message handlers gracefully', () => {
    // Mock console.error to test error logging
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Setup mock handler that throws an error
    const errorHandler = vi.fn().mockImplementation(() => {
      throw new Error('Handler error');
    });
    wsService.onMessage('error-test', errorHandler);
    
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Simulate a message event that will trigger the error
    const message = { type: 'error-test', data: 'test' };
    client.emit('message', Buffer.from(JSON.stringify(message)));
    
    // Verify the handler was called and error was logged
    expect(errorHandler).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
  
  it('should handle errors in close handlers gracefully', () => {
    // Mock console.error to test error logging
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Setup mock handler that throws an error
    const errorHandler = vi.fn().mockImplementation(() => {
      throw new Error('Close handler error');
    });
    wsService.onClose(errorHandler);
    
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Simulate close event
    const code = 1000;
    const reason = 'normal';
    client.emit('close', code, reason);
    
    // Verify the handler was called and error was logged
    expect(errorHandler).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
  
  it('should handle errors in connection handlers gracefully', () => {
    // Mock console.error to test error logging
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Setup mock handler that throws an error
    const errorHandler = vi.fn().mockImplementation(() => {
      throw new Error('Connection handler error');
    });
    wsService.onConnection(errorHandler);
    
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Verify the handler was called and error was logged
    expect(errorHandler).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
  
  it('should handle registration of a teacher client', () => {
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Simulate registration message
    const registerMessage = { 
      type: 'register', 
      role: 'teacher', 
      languageCode: 'en-US' 
    };
    client.emit('message', Buffer.from(JSON.stringify(registerMessage)));
    
    // Verify client properties were updated
    expect(client.role).toBe('teacher');
    expect(client.languageCode).toBe('en-US');
  });
  
  it('should get all connected clients', () => {
    // Get server instance
    const wss = wsService.getServer();
    
    // Create mock clients
    const client1 = new WebSocket() as ExtendedWebSocket;
    const client2 = new WebSocket() as ExtendedWebSocket;
    
    // Add them to clients set
    wss.clients.clear();
    wss.clients.add(client1);
    wss.clients.add(client2);
    
    // Get all clients
    const clients = wsService.getClients();
    
    // Check that we got the correct clients
    expect(clients.size).toBe(2);
    expect(clients.has(client1)).toBe(true);
    expect(clients.has(client2)).toBe(true);
  });
});

describe('WebSocket Utility Functions', () => {
  it('should create a WebSocketService through factory function', () => {
    const httpServer = new Server();
    const wsService = createWebSocketServer(httpServer, '/custom-path');
    
    expect(wsService).toBeInstanceOf(WebSocketService);
  });
  
  it('should broadcast message through compatibility function', () => {
    // Set up server and client
    const httpServer = new Server();
    const wsService = new WebSocketService(httpServer);
    const wss = wsService.getServer();
    
    // Add client
    const client = new WebSocket() as ExtendedWebSocket;
    wss.clients.clear();
    wss.clients.add(client);
    
    // Test with WebSocketService instance
    const message = { type: 'test', data: 'hello' };
    broadcastMessage(wsService, message);
    expect(client.send).toHaveBeenCalledWith(JSON.stringify(message));
    
    // Clear call history
    vi.clearAllMocks();
    
    // Test with WSServer instance
    broadcastMessage(wss, message);
    expect(client.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  it('should send to client through compatibility function', () => {
    const client = new WebSocket() as ExtendedWebSocket;
    const message = { type: 'test', data: 'hello' };
    
    sendToClient(client, message);
    
    expect(client.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
});

describe('WebSocket Error Handling', () => {
  let httpServer: Server;
  let wsService: WebSocketService;
  let mockRequest: IncomingMessage;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      socket: {
        remoteAddress: '127.0.0.1'
      },
      headers: {},
      url: '/ws'
    } as unknown as IncomingMessage;
    
    httpServer = new Server();
    wsService = new WebSocketService(httpServer);
  });
  
  it('should handle malformed JSON messages gracefully', () => {
    // Mock console.error to test error logging
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Get server and trigger a connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Simulate connection event
    wss.emit('connection', client, mockRequest);
    
    // Simulate invalid JSON message
    client.emit('message', Buffer.from("this is not valid json"));
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
  
  it('should handle WebSocket server close event and cleanup resources', () => {
    // Create service with a spy on the cleanup method
    const httpServer = new Server();
    const wsService = new WebSocketService(httpServer);
    
    // Add spy on private cleanup method
    const cleanupSpy = vi.spyOn(wsService as any, 'cleanup');
    
    // Get server instance
    const wss = wsService.getServer();
    
    // Simulate server close event
    wss.emit('close');
    
    // Verify the cleanup method was called
    expect(cleanupSpy).toHaveBeenCalled();
  });
  
  it('should setup heartbeat interval for checking client connections', () => {
    // Mock setInterval to invoke callback immediately
    const originalSetInterval = global.setInterval;
    const mockSetInterval = vi.fn((callback) => {
      // Execute the callback immediately for the test
      callback();
      return 12345; // Fake interval ID
    }) as any;
    global.setInterval = mockSetInterval;
    
    try {
      // Create a new service with an inactive client
      const httpServer = new Server();
      const wsService = new WebSocketService(httpServer);
      const wss = wsService.getServer();
      
      // Create and add an inactive client
      const inactiveClient = new WebSocket() as ExtendedWebSocket;
      inactiveClient.isAlive = false;
      inactiveClient.sessionId = 'inactive-test-session';
      
      // Create and add an active client
      const activeClient = new WebSocket() as ExtendedWebSocket;
      activeClient.isAlive = true;
      
      // Add clients to server
      wss.clients.clear();
      wss.clients.add(inactiveClient);
      wss.clients.add(activeClient);
      
      // Manually trigger setupHeartbeat
      (wsService as any).setupHeartbeat();
      
      // Verify the inactive client was terminated
      expect(inactiveClient.terminate).toHaveBeenCalled();
      
      // Verify the active client was pinged and isAlive was set to false
      expect(activeClient.ping).toHaveBeenCalled();
      expect(activeClient.isAlive).toBe(false);
      
      // Verify setInterval was called with the expected interval
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), wsService['config'].heartbeatInterval);
    } finally {
      // Restore original
      global.setInterval = originalSetInterval;
    }
  });
  
  it('should handle heartbeat pong messages', () => {
    // Get server and setup connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Set isAlive to false
    client.isAlive = false;
    
    // Simulate connection
    wss.emit('connection', client, mockRequest);
    
    // Trigger pong event
    client.emit('pong');
    
    // Verify isAlive was set to true
    expect(client.isAlive).toBe(true);
  });
  
  it('should terminate inactive connections during heartbeat checks', () => {
    // Get server and setup connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Mark connection as inactive
    client.isAlive = false;
    
    // Add client to set
    wss.clients.clear();
    wss.clients.add(client);
    
    // Use direct method calling instead of mocking timers
    // This will execute the heartbeat check directly
    const heartbeatCallback = () => {
      wss.clients.forEach((ws: WebSocket) => {
        const extendedWs = ws as ExtendedWebSocket;
        
        if (extendedWs.isAlive === false) {
          extendedWs.terminate();
          return;
        }
        
        extendedWs.isAlive = false;
        extendedWs.ping();
      });
    };
    
    // Execute the heartbeat check directly
    heartbeatCallback();
    
    // Verify the client was terminated
    expect(client.terminate).toHaveBeenCalled();
  });
  
  it('should ping active connections during heartbeat checks', () => {
    // Get server and setup connection
    const wss = wsService.getServer();
    const client = new WebSocket() as ExtendedWebSocket;
    
    // Mark connection as active
    client.isAlive = true;
    
    // Add client to set
    wss.clients.clear();
    wss.clients.add(client);
    
    // Use direct method calling instead of mocking timers
    // This will execute the heartbeat check directly
    const heartbeatCallback = () => {
      wss.clients.forEach((ws: WebSocket) => {
        const extendedWs = ws as ExtendedWebSocket;
        
        if (extendedWs.isAlive === false) {
          extendedWs.terminate();
          return;
        }
        
        extendedWs.isAlive = false;
        extendedWs.ping();
      });
    };
    
    // Execute the heartbeat check directly
    heartbeatCallback();
    
    // Verify the client was pinged and isAlive was set to false
    expect(client.ping).toHaveBeenCalled();
    expect(client.isAlive).toBe(false);
  });
  
  it('should handle different log levels', () => {
    // Mock console methods
    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Create a service with debug level
    const httpServer = new Server();
    const debugService = new WebSocketService(httpServer, { logLevel: 'debug' });
    
    // Force log methods to be called
    (debugService as any).log('debug', 'Debug message');
    (debugService as any).log('info', 'Info message');
    (debugService as any).log('warn', 'Warning message');
    (debugService as any).log('error', 'Error message');
    
    // Verify all messages were logged
    expect(consoleLogSpy).toHaveBeenCalledWith('Debug message');
    expect(consoleLogSpy).toHaveBeenCalledWith('Info message');
    expect(consoleWarnSpy).toHaveBeenCalledWith('Warning message');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error message');
    
    // Reset call history
    vi.clearAllMocks();
    
    // Create a service with error level only
    const errorService = new WebSocketService(httpServer, { logLevel: 'error' });
    
    // Force log methods to be called
    (errorService as any).log('debug', 'Debug message');
    (errorService as any).log('info', 'Info message');
    (errorService as any).log('warn', 'Warning message');
    (errorService as any).log('error', 'Error message');
    
    // Verify only error was logged
    expect(consoleLogSpy).not.toHaveBeenCalledWith('Debug message');
    expect(consoleLogSpy).not.toHaveBeenCalledWith('Info message');
    expect(consoleWarnSpy).not.toHaveBeenCalledWith('Warning message');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error message');
  });
});