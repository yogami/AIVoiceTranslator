/**
 * Enhanced WebSocket Coverage Tests
 * 
 * These tests build on the existing websocket.spec.ts but target untested functionality
 * to maximize coverage. This includes error handling, edge cases, and specific methods
 * that weren't previously covered.
 * 
 * Converted from Jest to Vitest
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketService, WebSocketState, createWebSocketServer, broadcastMessage, sendToClient } from '../../server/websocket';
import { Server } from 'http';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { EventEmitter } from 'events';

// Override the imports with our mocked versions - must be defined before class definitions
vi.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;
  
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
    
    // Add ability to throw errors for testing
    sendWithError = vi.fn().mockImplementation(() => {
      throw new Error('Mock send error');
    });
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

describe('WebSocket Service Enhanced Coverage Tests', () => {
  // Common variables for all tests
  let httpServer: Server;
  let wsService: WebSocketService;
  let mockWSServer: any;
  let mockClients: Set<any>;
  let mockClient1: any;
  let mockClient2: any;

  // Set up common test environment
  beforeEach(() => {
    // Create a mock HTTP server
    httpServer = {
      on: vi.fn(),
      listen: vi.fn(),
      close: vi.fn()
    } as unknown as Server;
    
    // Reset WebSocketState to expected values to avoid confusion
    Object.defineProperty(WebSocketState, 'OPEN', { value: 1 });
    Object.defineProperty(WebSocketState, 'CONNECTING', { value: 0 });
    Object.defineProperty(WebSocketState, 'CLOSING', { value: 2 });
    Object.defineProperty(WebSocketState, 'CLOSED', { value: 3 });
    
    // Create mock clients and server
    mockClient1 = new (WebSocket as any)();
    mockClient2 = new (WebSocket as any)();
    
    // Deliberately set different properties to test filtering
    mockClient1.role = 'teacher';
    mockClient1.sessionId = 'room1';
    mockClient1.languageCode = 'en-US';
    
    mockClient2.role = 'student';
    mockClient2.sessionId = 'room1';
    mockClient2.languageCode = 'es';
    
    // Create a mock server for the service
    mockWSServer = new (WSServer as any)({ noServer: true });
    mockClients = mockWSServer.clients;
    mockClients.add(mockClient1);
    mockClients.add(mockClient2);
    
    // Create the WebSocketService instance
    wsService = createWebSocketServer(httpServer);
    // Inject our mock server for testing
    (wsService as any).wss = mockWSServer;
  });

  // Reset mocks after each test
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should sendToClient gracefully handle errors', () => {
    // Arrange - Create client with error-throwing send
    const errorClient = new (WebSocket as any)();
    // Mock console.error to prevent actual logging during test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a spy that will throw when called
    errorClient.send = vi.fn().mockImplementation(() => {
      throw new Error('Mock send error');
    });
    
    // Act - Call function (it should catch errors internally)
    sendToClient(errorClient, { type: 'test', data: 'test-data' });
    
    // Assert - Verify the error was handled (console.error was called)
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    // Cleanup
    consoleErrorSpy.mockRestore();
  });

  it('should broadcast message to all connected clients', () => {
    // Arrange - Set up test data
    const message = { type: 'test', content: 'hello', targetLanguage: 'es' };
    
    // Act - broadcast the message
    broadcastMessage(mockWSServer, message);
    
    // Assert - All clients should receive the message
    expect(mockClient1.send).toHaveBeenCalled();
    expect(mockClient2.send).toHaveBeenCalled();
  });

  it('should broadcast to all clients regardless of role', () => {
    // Arrange - Set up test data
    const message = { type: 'test', content: 'teacher-only' };
    
    // Act - broadcast the message
    broadcastMessage(mockWSServer, message);
    
    // Assert - All clients should receive the message regardless of role
    expect(mockClient1.send).toHaveBeenCalled(); // Teacher client
    expect(mockClient2.send).toHaveBeenCalled(); // Student client
  });

  it('should broadcastMessage filter by sessionId correctly', () => {
    // Arrange - Create an additional client with different session
    const mockClient3 = new (WebSocket as any)();
    mockClient3.sessionId = 'room2';
    mockClient3.role = 'teacher';
    mockClients.add(mockClient3);
    
    // Act - broadcast with session filter
    broadcastMessage(mockWSServer, { type: 'room-message' }, { sessionId: 'room1' });
    
    // Assert - Only clients in room1 should receive the message
    expect(mockClient1.send).toHaveBeenCalled(); // In room1
    expect(mockClient2.send).toHaveBeenCalled(); // In room1
    expect(mockClient3.send).not.toHaveBeenCalled(); // In room2
  });

  it('should handle combined filters correctly', () => {
    // Arrange - Create test data
    const message = { type: 'selective-test' };
    
    // Act - apply multiple filters
    broadcastMessage(mockWSServer, message, {
      role: 'student',
      sessionId: 'room1',
      languageCode: 'es'
    });
    
    // Assert - Only clients matching ALL criteria should receive the message
    expect(mockClient1.send).not.toHaveBeenCalled(); // Teacher, doesn't match
    expect(mockClient2.send).toHaveBeenCalled(); // Student in room1 with Spanish, matches
  });

  it('should handle client with no properties defined', () => {
    // Arrange - Create a client missing the expected properties
    const incompleteClient = new (WebSocket as any)();
    mockClients.add(incompleteClient);
    
    // Act - Send with filters
    broadcastMessage(mockWSServer, { type: 'test' }, {
      role: 'any-role',
      sessionId: 'any-session',
      languageCode: 'any-language'
    });
    
    // Assert - Client with missing properties should not receive the message
    expect(incompleteClient.send).not.toHaveBeenCalled();
  });

  it('should handle closed WebSocket connections properly', () => {
    // Arrange - Set client to CLOSED state
    mockClient1.readyState = WebSocketState.CLOSED;
    
    // Act - Try to send a message
    broadcastMessage(mockWSServer, { type: 'test' });
    
    // Assert - Closed connections should be skipped
    expect(mockClient1.send).not.toHaveBeenCalled(); // Closed, should be skipped
    expect(mockClient2.send).toHaveBeenCalled(); // Open, should receive message
  });

  it('should register upgrade handler and properly create WebSocketService', () => {
    // Create a new service to test initialization
    const newService = createWebSocketServer(httpServer);
    
    // Verify upgrade handler registration
    expect(httpServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
    
    // Verify service is created with expected properties
    expect(newService).toBeDefined();
    expect(newService).toBeInstanceOf(WebSocketService);
  });

  it('should have WebSocketService close method terminate all clients', () => {
    // Act - Call close on the service
    wsService.close();
    
    // Assert - All clients should be terminated
    expect(mockClient1.terminate).toHaveBeenCalled();
    expect(mockClient2.terminate).toHaveBeenCalled();
  });
});