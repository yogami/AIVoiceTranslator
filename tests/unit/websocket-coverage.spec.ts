/**
 * Enhanced WebSocket Coverage Tests
 * 
 * These tests build on the existing websocket.spec.ts but target untested functionality
 * to maximize coverage. This includes error handling, edge cases, and specific methods
 * that weren't previously covered.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocketService, WebSocketState, createWebSocketServer, broadcastMessage, sendToClient } from '../../server/websocket';
import { Server } from 'http';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { EventEmitter } from 'events';

// Override the imports with our mocked versions - must be defined before class definitions
jest.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;
  
  // Use a factory function to create instances
  class MockWebSocket extends EventEmitter {
    readyState = WebSocketState.OPEN;
    isAlive = true;
    sessionId = undefined;
    role = undefined;
    languageCode = undefined;
    
    send = jest.fn();
    ping = jest.fn();
    terminate = jest.fn();
    
    // Add ability to throw errors for testing
    sendWithError = jest.fn().mockImplementation(() => {
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
    WebSocketServer: jest.fn((options) => new MockWSServer(options)),
    WebSocket: MockWebSocket
  };
});

jest.mock('http', () => {
  const EventEmitter = require('events').EventEmitter;
  
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
  
  send = jest.fn();
  ping = jest.fn();
  terminate = jest.fn();
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

describe('WebSocketService Error Handling and Edge Cases', () => {
  let mockServer: MockServer;
  let webSocketService: WebSocketService;
  let wss: MockWSServer;
  
  // Save console methods
  const originalConsole = { ...console };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Create mocked server
    mockServer = new MockServer();
    
    // Create WebSocket service
    webSocketService = new WebSocketService(mockServer as unknown as Server);
    
    // Get the mocked WebSocketServer
    wss = jest.mocked(WSServer).mock.results[0].value as unknown as MockWSServer;
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });
  
  // Test error handling in message handlers
  it('should handle errors in message handlers gracefully', () => {
    // Create a message handler that throws an error
    const errorHandler = jest.fn().mockImplementation(() => {
      throw new Error('Handler error');
    });
    
    // Register the error-throwing handler
    webSocketService.onMessage('test-error', errorHandler);
    
    // Create a mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event to register the client
    wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Create an error-triggering message
    const errorMessage = JSON.stringify({
      type: 'test-error',
      data: 'error-data'
    });
    
    // Emit the message
    mockClient.emit('message', errorMessage);
    
    // Verify error was handled and logged
    expect(errorHandler).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in message handler'),
      expect.any(Error)
    );
  });
  
  // Test error handling in close handlers
  it('should handle errors in close handlers gracefully', () => {
    // Create a close handler that throws an error
    const errorCloseHandler = jest.fn().mockImplementation(() => {
      throw new Error('Close handler error');
    });
    
    // Register the error-throwing handler
    webSocketService.onClose(errorCloseHandler);
    
    // Create a mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event to register the client
    wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Emit close event
    mockClient.emit('close', 1000, 'normal closure');
    
    // Verify error was handled and logged
    expect(errorCloseHandler).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in close handler'),
      expect.any(Error)
    );
  });
  
  // Test error handling in connection handlers
  it('should handle errors in connection handlers gracefully', () => {
    // Create a connection handler that throws an error
    const errorConnectionHandler = jest.fn().mockImplementation(() => {
      throw new Error('Connection handler error');
    });
    
    // Register the error-throwing handler
    webSocketService.onConnection(errorConnectionHandler);
    
    // Create a mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event 
    wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Verify error was handled and logged
    expect(errorConnectionHandler).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in connection handler'),
      expect.any(Error)
    );
  });
  
  // Test parsing invalid JSON in message handler
  it('should handle invalid JSON in messages', () => {
    // Create a mock client
    const mockClient = new MockWebSocket();
    
    // Emit connection event to register the client
    wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Send invalid JSON message
    mockClient.emit('message', 'This is not valid JSON');
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing message'),
      expect.any(Error)
    );
  });
  
  // Test WebSocket server close event
  it('should handle WebSocket server close event', () => {
    // Mock clearInterval
    const originalClearInterval = global.clearInterval;
    global.clearInterval = jest.fn();
    
    try {
      // Emit close event on the WebSocket server
      wss.emit('close');
      
      // Verify cleanup was called
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket server closed')
      );
      expect(global.clearInterval).toHaveBeenCalled();
    } finally {
      // Restore original function
      global.clearInterval = originalClearInterval;
    }
  });
  
  // Test getServer method (not covered in original tests)
  it('should return the WebSocket server instance', () => {
    const serverInstance = webSocketService.getServer();
    expect(serverInstance).toBe(wss);
  });
  
  // Test different log levels
  it('should respect log level configuration', () => {
    // Create a service with debug level logs
    const debugService = new WebSocketService(mockServer as unknown as Server, {
      logLevel: 'debug'
    });
    
    // Create a service with error-only logs
    const errorService = new WebSocketService(mockServer as unknown as Server, {
      logLevel: 'error'
    });
    
    // Create a service with no logs
    const silentService = new WebSocketService(mockServer as unknown as Server, {
      logLevel: 'none'
    });
    
    // Clear console mocks
    jest.clearAllMocks();
    
    // Trigger various log levels by creating clients (which logs at info level)
    const mockClient1 = new MockWebSocket();
    const mockClient2 = new MockWebSocket();
    const mockClient3 = new MockWebSocket();
    
    // Get the mocked WebSocketServer instances
    const debugWSS = jest.mocked(WSServer).mock.results[1].value as unknown as MockWSServer;
    const errorWSS = jest.mocked(WSServer).mock.results[2].value as unknown as MockWSServer;
    const silentWSS = jest.mocked(WSServer).mock.results[3].value as unknown as MockWSServer;
    
    // Emit connections for each service type
    debugWSS.emit('connection', mockClient1, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    errorWSS.emit('connection', mockClient2, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    silentWSS.emit('connection', mockClient3, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
    
    // Debug service should log info messages
    expect(console.log).toHaveBeenCalled();
    
    // Reset mock to test error level
    jest.clearAllMocks();
    
    // Create mock error events
    mockClient1.emit('message', 'invalid json for debug service');
    mockClient2.emit('message', 'invalid json for error service');
    mockClient3.emit('message', 'invalid json for silent service');
    
    // Debug and error services should log errors, silent should not
    const errorCallCount = (console.error as jest.Mock).mock.calls.length;
    expect(errorCallCount).toBe(2); // Debug and error services
  });
  
  // Test broadcastMessage function with WebSocketService instance
  it('should handle broadcastMessage with WebSocketService instance', () => {
    // Create mock client
    const mockClient = new MockWebSocket();
    wss.clients.add(mockClient);
    
    // Use broadcastMessage utility function with WebSocketService instance
    const message = { type: 'test', data: 'service-broadcast-test' };
    broadcastMessage(webSocketService, message);
    
    // Verify broadcast was called on service
    expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  // Test sendToClient with closed client
  it('should not send to client with error during send', () => {
    // Create a client with a send method that throws
    const errorClient = new MockWebSocket();
    errorClient.send = jest.fn().mockImplementation(() => {
      throw new Error('Send error');
    });
    
    // Call sendToClient
    const message = { type: 'test', data: 'test-data' };
    
    // This should not throw
    expect(() => {
      webSocketService.sendToClient(errorClient as any, message);
    }).not.toThrow();
    
    // Check console for error
    expect(console.error).toHaveBeenCalled();
  });
});