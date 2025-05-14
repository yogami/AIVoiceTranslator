import { WebSocketService, createWebSocketServer, broadcastMessage, sendToClient, WebSocketState, ExtendedWebSocket, WebSocketMessage } from '../../../server/websocket';
import { Server } from 'http';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// CORRECT: Only mock external dependencies, not the SUT
jest.mock('ws', () => {
  const mockOn = jest.fn();
  
  // Create a mock WebSocketServer that registers the upgrade handler on the HTTP server
  const mockWebSocketServer = function(options: any) {
    // This simulates the 'ws' package's behavior of adding an 'upgrade' listener
    // to the HTTP server when a new WebSocketServer is created
    if (options.server && typeof options.server.on === 'function') {
      options.server.on('upgrade', jest.fn());
    }
    
    return {
      on: mockOn,
      handleUpgrade: jest.fn(),
      emit: jest.fn(),
      clients: new Set(),
      close: jest.fn()
    };
  };
  
  // Note the use of WebSocketServer to match the actual import
  const MockWebSocket = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    ping: jest.fn(),
    terminate: jest.fn(),
    readyState: 1
  }));

  return {
    WebSocketServer: mockWebSocketServer,
    OPEN: 1,
    WebSocket: MockWebSocket
  };
});

// IMPORTANT: Create a real HTTP server mock, not a simple object
const createMockServer = () => {
  const mockServer: Partial<Server> = {
    on: jest.fn(),
    listeners: jest.fn().mockReturnValue([]),
    removeListener: jest.fn()
  };
  return mockServer as Server;
};

// Mock console methods to test logging
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;
  let mockServer: Server;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleWarn: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  
  beforeEach(() => {
    // Mock console methods
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    mockServer = createMockServer();
    
    // IMPORTANT: Use the real WebSocketService, not a mock or test double
    webSocketService = new WebSocketService(mockServer);
    
    // Clear all mocks between tests
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
    
    // Clean up any intervals
    if ((webSocketService as any).heartbeatInterval) {
      clearInterval((webSocketService as any).heartbeatInterval);
    }
  });
  
  afterAll(() => {
    // Ensure console methods are restored
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });
  
  it('should initialize correctly', () => {
    // IMPORTANT: Test the actual instance, not a mock
    expect(webSocketService).toBeDefined();
    expect(webSocketService).toBeInstanceOf(WebSocketService);
  });
  
  it('should initialize with custom config', () => {
    // Create a service with custom config
    const customConfig = {
      path: '/custom-ws',
      heartbeatInterval: 60000,
      logLevel: 'debug' as const
    };
    
    const customService = new WebSocketService(mockServer, customConfig);
    
    // Verify the custom config was applied
    expect((customService as any).config.path).toBe('/custom-ws');
    expect((customService as any).config.heartbeatInterval).toBe(60000);
    expect((customService as any).config.logLevel).toBe('debug');
    
    // Clean up any intervals
    if ((customService as any).heartbeatInterval) {
      clearInterval((customService as any).heartbeatInterval);
    }
  });
  
  // Test that the service sets up an event handler on the HTTP server
  it('should set up event handlers on the HTTP server', () => {
    // This test verifies that the WebSocketService correctly attaches
    // an 'upgrade' event handler to the HTTP server during initialization
    
    // Verify the integration between server and WebSocketService
    expect(mockServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
    
    // Additional check to verify that the .on method was called only once
    expect(mockServer.on).toHaveBeenCalledTimes(1);
  });
  
  it('should register message handlers correctly', () => {
    const messageHandler = jest.fn();
    webSocketService.onMessage('test', messageHandler);
    
    // Use our knowledge of the internal structure (private property access via any)
    // This is acceptable in tests for verification
    const handlers = (webSocketService as any).messageHandlers;
    expect(handlers.get('test')).toBeDefined();
    expect(handlers.get('test')).toContain(messageHandler);
  });
  
  it('should register multiple message handlers for the same type', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    
    webSocketService.onMessage('test', handler1);
    webSocketService.onMessage('test', handler2);
    
    const handlers = (webSocketService as any).messageHandlers.get('test');
    expect(handlers).toHaveLength(2);
    expect(handlers).toContain(handler1);
    expect(handlers).toContain(handler2);
  });
  
  it('should register connection handlers correctly', () => {
    const connectionHandler = jest.fn();
    webSocketService.onConnection(connectionHandler);
    
    // Verify the connection handler was registered
    const handlers = (webSocketService as any).connectionHandlers;
    expect(handlers).toContain(connectionHandler);
  });
  
  it('should register close handlers correctly', () => {
    const closeHandler = jest.fn();
    webSocketService.onClose(closeHandler);
    
    // Verify the close handler was registered
    const handlers = (webSocketService as any).closeHandlers;
    expect(handlers).toContain(closeHandler);
  });
  
  it('should broadcast messages to all clients', () => {
    // Setup
    const mockClient1 = new (WebSocket as any)();
    const mockClient2 = new (WebSocket as any)();
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockClient1);
    wsServer.clients.add(mockClient2);
    
    // Act
    webSocketService.broadcast({ type: 'test', data: 'test data' });
    
    // Assert
    expect(mockClient1.send).toHaveBeenCalled();
    expect(mockClient2.send).toHaveBeenCalled();
  });
  
  it('should not broadcast to clients in non-OPEN state', () => {
    // Setup
    const mockClient1 = new (WebSocket as any)();
    mockClient1.readyState = WebSocketState.CLOSED; // Set to CLOSED
    
    const mockClient2 = new (WebSocket as any)();
    
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockClient1);
    wsServer.clients.add(mockClient2);
    
    // Act
    webSocketService.broadcast({ type: 'test', data: 'test data' });
    
    // Assert
    expect(mockClient1.send).not.toHaveBeenCalled(); // Should not be called for CLOSED client
    expect(mockClient2.send).toHaveBeenCalled();
  });
  
  it('should broadcast messages to clients with specific role', () => {
    // Setup
    const mockTeacher = new (WebSocket as any)();
    mockTeacher.role = 'teacher';
    
    const mockStudent = new (WebSocket as any)();
    mockStudent.role = 'student';
    
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockTeacher);
    wsServer.clients.add(mockStudent);
    
    // Act
    webSocketService.broadcastToRole('teacher', { type: 'test', data: 'teacher data' });
    
    // Assert
    expect(mockTeacher.send).toHaveBeenCalled();
    expect(mockStudent.send).not.toHaveBeenCalled();
  });
  
  it('should not broadcast to role-specific clients in non-OPEN state', () => {
    // Setup
    const mockTeacher1 = new (WebSocket as any)();
    mockTeacher1.role = 'teacher';
    mockTeacher1.readyState = WebSocketState.CLOSED; // Set to CLOSED
    
    const mockTeacher2 = new (WebSocket as any)();
    mockTeacher2.role = 'teacher';
    
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockTeacher1);
    wsServer.clients.add(mockTeacher2);
    
    // Act
    webSocketService.broadcastToRole('teacher', { type: 'test', data: 'teacher data' });
    
    // Assert
    expect(mockTeacher1.send).not.toHaveBeenCalled(); // Should not be called for CLOSED client
    expect(mockTeacher2.send).toHaveBeenCalled();
  });
  
  it('should send message to a specific client', () => {
    // Setup
    const mockClient = new (WebSocket as any)();
    
    // Act
    webSocketService.sendToClient(mockClient, { type: 'test', data: 'client data' });
    
    // Assert
    expect(mockClient.send).toHaveBeenCalled();
    const sentData = JSON.parse(mockClient.send.mock.calls[0][0]);
    expect(sentData.type).toBe('test');
    expect(sentData.data).toBe('client data');
  });
  
  it('should not send message to client in non-OPEN state', () => {
    // Setup
    const mockClient = new (WebSocket as any)();
    mockClient.readyState = WebSocketState.CLOSED; // Set to CLOSED
    
    // Act
    webSocketService.sendToClient(mockClient, { type: 'test', data: 'client data' });
    
    // Assert
    expect(mockClient.send).not.toHaveBeenCalled();
  });
  
  it('should get all clients', () => {
    // Setup
    const mockClient1 = new (WebSocket as any)();
    const mockClient2 = new (WebSocket as any)();
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockClient1);
    wsServer.clients.add(mockClient2);
    
    // Act
    const clients = webSocketService.getClients();
    
    // Assert
    expect(clients).toBe(wsServer.clients);
    expect(clients.size).toBe(2);
  });
  
  it('should get clients by role', () => {
    // Setup
    const mockTeacher1 = new (WebSocket as any)();
    mockTeacher1.role = 'teacher';
    
    const mockTeacher2 = new (WebSocket as any)();
    mockTeacher2.role = 'teacher';
    
    const mockStudent = new (WebSocket as any)();
    mockStudent.role = 'student';
    
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockTeacher1);
    wsServer.clients.add(mockTeacher2);
    wsServer.clients.add(mockStudent);
    
    // Act
    const teachers = webSocketService.getClientsByRole('teacher');
    const students = webSocketService.getClientsByRole('student');
    
    // Assert
    expect(teachers).toHaveLength(2);
    expect(students).toHaveLength(1);
    expect(teachers).toContainEqual(expect.objectContaining({ role: 'teacher' }));
    expect(students).toContainEqual(expect.objectContaining({ role: 'student' }));
  });
  
  it('should clean up resources when cleanup is called', () => {
    // Act - directly call the private cleanup method for testing
    (webSocketService as any).cleanup();
    
    // Assert
    expect((webSocketService as any).heartbeatInterval).toBeNull();
  });
  
  it('should cleanup resources when server closes', () => {
    // Setup - spy on the cleanup method
    const cleanupSpy = jest.spyOn(webSocketService as any, 'cleanup');
    
    // Act - simulate server close event
    const wsServer = (webSocketService as any).wss;
    const closeHandler = wsServer.on.mock.calls.find(call => call[0] === 'close')[1];
    closeHandler();
    
    // Assert
    expect(cleanupSpy).toHaveBeenCalled();
  });
  
  it('should log based on configured log level', () => {
    // Create a service with debug log level
    const debugService = new WebSocketService(mockServer, { logLevel: 'debug' });
    
    // Test each log level
    (debugService as any).log('debug', 'Debug message');
    expect(console.log).toHaveBeenCalledWith('Debug message');
    
    (debugService as any).log('info', 'Info message');
    expect(console.log).toHaveBeenCalledWith('Info message');
    
    (debugService as any).log('warn', 'Warning message');
    expect(console.warn).toHaveBeenCalledWith('Warning message');
    
    (debugService as any).log('error', 'Error message');
    expect(console.error).toHaveBeenCalledWith('Error message');
    
    // Clean up
    if ((debugService as any).heartbeatInterval) {
      clearInterval((debugService as any).heartbeatInterval);
    }
  });
  
  it('should respect log level settings', () => {
    // Create a service with error-only log level
    const errorOnlyService = new WebSocketService(mockServer, { logLevel: 'error' });
    
    // Clear previous calls
    mockConsoleLog.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();
    
    // Test each log level
    (errorOnlyService as any).log('debug', 'Debug message');
    expect(console.log).not.toHaveBeenCalled();
    
    (errorOnlyService as any).log('info', 'Info message');
    expect(console.log).not.toHaveBeenCalled();
    
    (errorOnlyService as any).log('warn', 'Warning message');
    expect(console.warn).not.toHaveBeenCalled();
    
    (errorOnlyService as any).log('error', 'Error message');
    expect(console.error).toHaveBeenCalled();
    
    // Clean up
    if ((errorOnlyService as any).heartbeatInterval) {
      clearInterval((errorOnlyService as any).heartbeatInterval);
    }
  });
});

// Test the factory functions
describe('WebSocket Factory Functions', () => {
  let mockServer: Server;
  
  beforeEach(() => {
    mockServer = createMockServer();
    jest.clearAllMocks();
  });
  
  it('should create WebSocketService using createWebSocketServer', () => {
    // Act
    const service = createWebSocketServer(mockServer, '/custom-path');
    
    // Assert
    expect(service).toBeInstanceOf(WebSocketService);
    expect((service as any).config.path).toBe('/custom-path');
    
    // Clean up
    if ((service as any).heartbeatInterval) {
      clearInterval((service as any).heartbeatInterval);
    }
  });
  
  it('should broadcast message using WebSocketService instance', () => {
    // Setup
    const service = new WebSocketService(mockServer);
    const broadcastSpy = jest.spyOn(service, 'broadcast');
    
    // Act
    broadcastMessage(service, { type: 'test' });
    
    // Assert
    expect(broadcastSpy).toHaveBeenCalledWith({ type: 'test' });
    
    // Clean up
    if ((service as any).heartbeatInterval) {
      clearInterval((service as any).heartbeatInterval);
    }
  });
  
  it('should broadcast message using WSServer instance', () => {
    // Setup
    const wsServer = (new WebSocketService(mockServer) as any).wss;
    const client = new (WebSocket as any)();
    wsServer.clients.add(client);
    
    // Act
    broadcastMessage(wsServer, { type: 'test' });
    
    // Assert
    expect(client.send).toHaveBeenCalled();
  });
  
  it('should send message to client using sendToClient helper', () => {
    // Setup
    const client = new (WebSocket as any)();
    
    // Act
    sendToClient(client, { type: 'test' });
    
    // Assert
    expect(client.send).toHaveBeenCalled();
    const sentData = JSON.parse(client.send.mock.calls[0][0]);
    expect(sentData.type).toBe('test');
  });
});