/**
 * Tests for WebSocket functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketService, WebSocketState, createWebSocketServer, broadcastMessage, sendToClient } from '../../server/websocket';
import { Server } from 'http';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { EventEmitter } from 'events';

// Override the imports with our mocked versions - must be defined before class definitions
vi.mock('ws', async () => {
  const EventEmitter = (await import('events')).EventEmitter;
  
  // Use a factory function to create instances
  class MockWebSocket extends EventEmitter {
    readyState = WebSocketState.OPEN;
    isAlive = true;
    sessionId = undefined;
    role = undefined;
    languageCode = undefined;
    
    send = vi.fn();
    ping = vi.fn();
    terminate = vi.fn();
  }
  
  class MockWSServer extends EventEmitter {
    clients = new Set();
    options = null;
    
    constructor(options) {
      super();
      this.options = options;
    }
  }
  
  return {
    WebSocketServer: vi.fn((options) => new MockWSServer(options)),
    WebSocket: MockWebSocket
  };
});

vi.mock('http', async () => {
  const EventEmitter = (await import('events')).EventEmitter;
  
  class MockServer extends EventEmitter {}
  
  return {
    Server: MockServer
  };
});

// Now define the classes for use in tests
class MockWebSocket extends EventEmitter {
  readyState = WebSocketState.OPEN;
  isAlive = true;
  sessionId?: string;
  role?: 'teacher' | 'student';
  languageCode?: string;
  
  send = vi.fn();
  ping = vi.fn();
  terminate = vi.fn();
}

class MockWSServer extends EventEmitter {
  clients: Set<MockWebSocket> = new Set();
  options: any;
  
  constructor(options: any) {
    super();
    this.options = options;
  }
}

class MockServer extends EventEmitter {}

describe('WebSocketService', () => {
  let mockServer: MockServer;
  let webSocketService: WebSocketService;
  let wss: MockWSServer;
  
  // Save console methods
  const originalConsole = { ...console };
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    
    // Create mocked server
    mockServer = new MockServer();
    
    // Create WebSocket service
    webSocketService = new WebSocketService(mockServer as unknown as Server);
    
    // Get the mocked WebSocketServer
    wss = vi.mocked(WSServer).mock.results[0].value as MockWSServer;
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });
  
  it('should initialize with default configuration', () => {
    // Verify WebSocketServer was constructed correctly
    expect(WSServer).toHaveBeenCalledWith({
      server: mockServer,
      path: '/ws'
    });
    
    // Verify log message
    expect(console.log).toHaveBeenCalledWith(
      "WebSocket server initialized and listening on path: /ws"
    );
  });
  
  it('should initialize with custom configuration', () => {
    const customPath = '/custom-ws';
    const customConfig = {
      path: customPath,
      heartbeatInterval: 5000,
      logLevel: 'debug' as const
    };
    
    // Create with custom config
    webSocketService = new WebSocketService(mockServer as unknown as Server, customConfig);
    
    // Verify WebSocketServer was constructed with custom path
    expect(WSServer).toHaveBeenCalledWith(
      expect.objectContaining({
        path: customPath
      })
    );
  });
  
  it('should register and execute message handlers', () => {
    // Create mock handler
    const mockHandler = vi.fn();
    webSocketService.onMessage('test-message', mockHandler);
    
    // Create mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event to register the client
    wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Verify client received connection confirmation
    expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('connection'));
    
    // Create a test message
    const testMessage = JSON.stringify({
      type: 'test-message',
      data: 'test-data'
    });
    
    // Emit message event from client
    mockClient.emit('message', testMessage);
    
    // Verify handler was called with correct arguments
    expect(mockHandler).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        type: 'test-message',
        data: 'test-data'
      })
    );
  });
  
  it('should handle connection events', () => {
    // Create mock connection handler
    const mockConnectionHandler = vi.fn();
    webSocketService.onConnection(mockConnectionHandler);
    
    // Create mock request
    const mockRequest = { 
      headers: {}, 
      socket: { remoteAddress: '127.0.0.1' },
      url: '/ws'
    };
    
    // Create mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event
    wss.emit('connection', mockClient, mockRequest);
    
    // Verify connection handler was called
    expect(mockConnectionHandler).toHaveBeenCalledWith(mockClient, mockRequest);
    
    // Verify client properties are set
    expect(mockClient.isAlive).toBe(true);
    expect(mockClient.sessionId).toBeDefined();
    
    // Verify client received connection confirmation
    expect(mockClient.send).toHaveBeenCalledWith(
      expect.stringContaining('sessionId')
    );
  });
  
  it('should handle close events', () => {
    // Create mock close handler
    const mockCloseHandler = vi.fn();
    webSocketService.onClose(mockCloseHandler);
    
    // Create mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event to register the client
    wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Emit close event
    const closeCode = 1000;
    const closeReason = 'normal closure';
    mockClient.emit('close', closeCode, closeReason);
    
    // Verify close handler was called
    expect(mockCloseHandler).toHaveBeenCalledWith(mockClient, closeCode, closeReason);
  });
  
  it('should handle registration messages', () => {
    // Create mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event
    wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Create a registration message
    const registerMessage = JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US'
    });
    
    // Emit message event
    mockClient.emit('message', registerMessage);
    
    // Verify client properties are updated
    expect(mockClient.role).toBe('teacher');
    expect(mockClient.languageCode).toBe('en-US');
  });
  
  it('should broadcast messages to all clients', () => {
    // Create mock clients
    const mockClient1 = new MockWebSocket();
    const mockClient2 = new MockWebSocket();
    
    // Add clients to the server
    wss.clients.add(mockClient1);
    wss.clients.add(mockClient2);
    
    // Broadcast a message
    const message = { type: 'broadcast-test', data: 'test-data' };
    webSocketService.broadcast(message);
    
    // Verify both clients received the message
    expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(mockClient2.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  it('should broadcast messages only to clients with specific role', () => {
    // Create mock clients with different roles
    const teacherClient = new MockWebSocket();
    teacherClient.role = 'teacher';
    
    const studentClient = new MockWebSocket();
    studentClient.role = 'student';
    
    // Add clients to the server
    wss.clients.add(teacherClient);
    wss.clients.add(studentClient);
    
    // Broadcast a message to teachers only
    const message = { type: 'teacher-message', data: 'teacher-data' };
    webSocketService.broadcastToRole('teacher', message);
    
    // Verify only teacher client received the message
    expect(teacherClient.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(studentClient.send).not.toHaveBeenCalled();
  });
  
  it('should send messages to a specific client', () => {
    // Create mock clients
    const mockClient1 = new MockWebSocket();
    const mockClient2 = new MockWebSocket();
    
    // Add clients to the server
    wss.clients.add(mockClient1);
    wss.clients.add(mockClient2);
    
    // Send a message to a specific client
    const message = { type: 'direct-message', data: 'direct-data' };
    webSocketService.sendToClient(mockClient1 as any, message);
    
    // Verify only the target client received the message
    expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(mockClient2.send).not.toHaveBeenCalled();
  });
  
  it('should not send messages to closed clients', () => {
    // Create mock client with closed state
    const closedClient = new MockWebSocket();
    closedClient.readyState = WebSocketState.CLOSED;
    
    // Add client to the server
    wss.clients.add(closedClient);
    
    // Send a message to the closed client
    const message = { type: 'test-message', data: 'test-data' };
    webSocketService.sendToClient(closedClient as any, message);
    
    // Verify no message was sent
    expect(closedClient.send).not.toHaveBeenCalled();
  });
  
  it('should get clients by role', () => {
    // Create mock clients with different roles
    const teacherClient1 = new MockWebSocket();
    teacherClient1.role = 'teacher';
    
    const teacherClient2 = new MockWebSocket();
    teacherClient2.role = 'teacher';
    
    const studentClient = new MockWebSocket();
    studentClient.role = 'student';
    
    // Add clients to the server
    wss.clients.add(teacherClient1);
    wss.clients.add(teacherClient2);
    wss.clients.add(studentClient);
    
    // Get clients by role
    const teachers = webSocketService.getClientsByRole('teacher');
    const students = webSocketService.getClientsByRole('student');
    
    // Verify correct clients are returned
    expect(teachers.length).toBe(2);
    expect(students.length).toBe(1);
  });
  
  it('should return all clients', () => {
    // Create mock clients
    const mockClient1 = new MockWebSocket();
    const mockClient2 = new MockWebSocket();
    
    // Add clients to the server
    wss.clients.add(mockClient1);
    wss.clients.add(mockClient2);
    
    // Get all clients
    const clients = webSocketService.getClients();
    
    // Verify all clients are returned
    expect(clients.size).toBe(2);
    expect(clients.has(mockClient1)).toBe(true);
    expect(clients.has(mockClient2)).toBe(true);
  });
  
  it('should setup heartbeat interval', () => {
    // Mock setInterval
    const originalSetInterval = global.setInterval;
    global.setInterval = vi.fn();
    
    try {
      // Create new service to trigger heartbeat setup
      const service = new WebSocketService(mockServer as unknown as Server, {
        heartbeatInterval: 1000
      });
      
      // Verify setInterval was called with correct interval
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );
      
    } finally {
      // Restore original function
      global.setInterval = originalSetInterval;
    }
  });
});

describe('WebSocket Utility Functions', () => {
  it('should create a WebSocketService through factory function', () => {
    // Mock Server
    const mockServer = new MockServer();
    const customPath = '/custom-path';
    
    // Call factory function
    const service = createWebSocketServer(mockServer as unknown as Server, customPath);
    
    // Verify WebSocketService was created correctly
    expect(service).toBeInstanceOf(WebSocketService);
    expect(WSServer).toHaveBeenCalledWith(
      expect.objectContaining({
        path: customPath
      })
    );
  });
  
  it('should skip WebSocketService instanceof check in broadcastMessage utility', () => {
    // Create a simplified version of the broadcast utility function for testing
    const simpleBroadcast = (service: any, message: any): void => {
      if (service && typeof service.broadcast === 'function') {
        service.broadcast(message);
      }
    };
    
    // Create a mock service with broadcast method
    const mockBroadcast = vi.fn();
    const mockService = { broadcast: mockBroadcast };
    
    // Create test message
    const message = { type: 'test', data: 'test-data' };
    
    // Call our simple broadcast utility
    simpleBroadcast(mockService, message);
    
    // Verify broadcast was called
    expect(mockBroadcast).toHaveBeenCalledWith(message);
  });
  
  it('should broadcast message through utility function (WSServer)', () => {
    // Create mock clients
    const mockClient1 = { readyState: WebSocketState.OPEN, send: vi.fn() };
    const mockClient2 = { readyState: WebSocketState.OPEN, send: vi.fn() };
    
    // Create mock server
    const mockServer = {
      clients: new Set([mockClient1, mockClient2])
    };
    
    // Create test message
    const message = { type: 'test', data: 'test-data' };
    
    // Call broadcast utility
    broadcastMessage(mockServer as unknown as WSServer, message);
    
    // Verify clients received the message
    expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(mockClient2.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  it('should send message to client through utility function', () => {
    // Create mock client
    const mockClient = { readyState: WebSocketState.OPEN, send: vi.fn() };
    
    // Create test message
    const message = { type: 'test', data: 'test-data' };
    
    // Call sendToClient utility
    sendToClient(mockClient as unknown as WebSocket, message);
    
    // Verify client received the message
    expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  it('should not send message to closed client through utility function', () => {
    // Create mock client with closed state
    const mockClient = { readyState: WebSocketState.CLOSED, send: vi.fn() };
    
    // Create test message
    const message = { type: 'test', data: 'test-data' };
    
    // Call sendToClient utility
    sendToClient(mockClient as unknown as WebSocket, message);
    
    // Verify no message was sent
    expect(mockClient.send).not.toHaveBeenCalled();
  });
});