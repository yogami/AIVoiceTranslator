/**
 * Enhanced WebSocket Coverage Tests
 * 
 * These tests build on the existing websocket.spec.ts but target untested functionality
 * to maximize coverage. This includes error handling, edge cases, and specific methods
 * that weren't previously covered.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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
  
  // Add ability to throw errors for testing
  sendWithError() {
    throw new Error('Mock send error');
  }
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

describe('WebSocketService Extended Coverage', () => {
  let mockServer: MockServer;
  let webSocketService: WebSocketService;
  let wss: MockWSServer;
  let clockTime: number = 0;
  
  // Save console methods
  const originalConsole = { ...console };
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    clockTime = Date.now();
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Mock timing functions
    global.setInterval = jest.fn().mockImplementation((fn, ms) => {
      return 123; // Return a mock timer ID
    });
    
    global.clearInterval = jest.fn();
    
    // Mock Date.now
    jest.spyOn(Date, 'now').mockImplementation(() => clockTime);
    
    // Create mocked server
    mockServer = new MockServer();
    
    // Create WebSocket service
    webSocketService = new WebSocketService(mockServer as unknown as Server);
    
    // Get the mocked WebSocketServer
    wss = jest.mocked(WSServer).mock.results[0].value as MockWSServer;
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    
    // Restore timing functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    
    // Restore Date.now
    vi.restoreAllMocks();
  });
  
  describe('Error Handling Tests', () => {
    it('should handle message parsing errors', () => {
      // Create mock client
      const mockClient = new MockWebSocket();
      
      // Emit connection event to register client
      wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      
      // Send invalid JSON
      mockClient.emit('message', 'this is not valid JSON');
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Error processing message:',
        expect.any(Error)
      );
    });
    
    it('should handle message handler errors', () => {
      // Create a handler that throws an error
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      
      // Register the handler
      webSocketService.onMessage('error-test', errorHandler);
      
      // Create mock client
      const mockClient = new MockWebSocket();
      
      // Emit connection event
      wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      
      // Send a message that triggers the error handler
      mockClient.emit('message', JSON.stringify({ type: 'error-test', data: 'test' }));
      
      // Verify handler was called
      expect(errorHandler).toHaveBeenCalled();
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Error in message handler for type error-test:',
        expect.any(Error)
      );
    });
    
    it('should handle connection handler errors', () => {
      // Create a connection handler that throws an error
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Connection handler error');
      });
      
      // Register the handler
      webSocketService.onConnection(errorHandler);
      
      // Create mock client
      const mockClient = new MockWebSocket();
      
      // Emit connection event
      wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      
      // Verify handler was called
      expect(errorHandler).toHaveBeenCalled();
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Error in connection handler:',
        expect.any(Error)
      );
    });
    
    it('should handle close handler errors', () => {
      // Create a close handler that throws an error
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Close handler error');
      });
      
      // Register the handler
      webSocketService.onClose(errorHandler);
      
      // Create mock client
      const mockClient = new MockWebSocket();
      
      // Emit connection event
      wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      
      // Emit close event
      mockClient.emit('close', 1000, 'Normal closure');
      
      // Verify handler was called
      expect(errorHandler).toHaveBeenCalled();
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Error in close handler:',
        expect.any(Error)
      );
    });
  });
  
  describe('Heartbeat Mechanism Tests', () => {
    it('should terminate inactive connections in heartbeat interval', () => {
      // Create mock clients
      const activeClient = new MockWebSocket();
      activeClient.isAlive = true;
      
      const inactiveClient = new MockWebSocket();
      inactiveClient.isAlive = false;
      
      // Add clients to the server
      wss.clients.add(activeClient);
      wss.clients.add(inactiveClient);
      
      // Get the heartbeat callback
      const heartbeatCallback = (global.setInterval as jest.Mock).mock.calls[0][0];
      
      // Execute the heartbeat callback
      heartbeatCallback();
      
      // Verify inactive client was terminated
      expect(inactiveClient.terminate).toHaveBeenCalled();
      expect(activeClient.terminate).not.toHaveBeenCalled();
      
      // Verify active client isAlive was set to false and ping was sent
      expect(activeClient.isAlive).toBe(false);
      expect(activeClient.ping).toHaveBeenCalled();
    });
    
    it('should handle pong messages to reset heartbeat status', () => {
      // Create mock client
      const mockClient = new MockWebSocket();
      
      // Emit connection event
      wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      
      // Set isAlive to false
      mockClient.isAlive = false;
      
      // Emit pong event
      mockClient.emit('pong');
      
      // Verify isAlive was set to true
      expect(mockClient.isAlive).toBe(true);
    });
    
    it('should cleanup heartbeat interval on close', () => {
      // Trigger server close event
      wss.emit('close');
      
      // Verify clearInterval was called
      expect(global.clearInterval).toHaveBeenCalled();
    });
  });
  
  describe('Logging Functionality Tests', () => {
    it('should log with different log levels', () => {
      // Create service with debug log level
      const debugService = new WebSocketService(mockServer as unknown as Server, {
        logLevel: 'debug'
      });
      
      // Test each log level
      
      // Debug logs should appear with debug level
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket server initialized'),
        expect.anything()
      );
      
      // Create service with error log level
      console.log = vi.fn(); // Reset
      console.error = vi.fn();
      console.warn = vi.fn();
      
      const errorService = new WebSocketService(mockServer as unknown as Server, {
        logLevel: 'error'
      });
      
      // Only error logs should appear
      expect(console.log).not.toHaveBeenCalled();
      
      // Test error logging
      const mockClient = new MockWebSocket();
      wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      mockClient.emit('message', 'invalid json');
      
      expect(console.error).toHaveBeenCalled();
    });
    
    it('should not log when log level is none', () => {
      console.log = vi.fn();
      console.error = vi.fn();
      console.warn = vi.fn();
      
      // Create service with none log level
      const noneService = new WebSocketService(mockServer as unknown as Server, {
        logLevel: 'none'
      });
      
      // No logs should appear
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
  
  describe('Role Management Tests', () => {
    it('should handle role change messages', () => {
      // Create mock client
      const mockClient = new MockWebSocket();
      mockClient.role = 'student';
      
      // Emit connection event
      wss.emit('connection', mockClient, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      
      // Send role change message
      mockClient.emit('message', JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      // Verify role was updated
      expect(mockClient.role).toBe('teacher');
      
      // Verify log about role change
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Changing connection role'),
        expect.anything()
      );
    });
  });
  
  describe('Utility Function Coverage', () => {
    it('should expose the WebSocket server instance', () => {
      // Get the server
      const server = webSocketService.getServer();
      
      // Verify it's the correct server
      expect(server).toBe(wss);
    });
    
    it('should handle broadcastMessage edge cases', () => {
      // Test WebSocketService path
      const service = new WebSocketService(mockServer as unknown as Server);
      const message = { type: 'test', data: 'data' };
      
      // Spy on the broadcast method
      const broadcastSpy = vi.spyOn(service, 'broadcast');
      
      // Call utility function
      broadcastMessage(service, message);
      
      // Verify service.broadcast was called
      expect(broadcastSpy).toHaveBeenCalledWith(message);
    });
  });
});

describe('WebSocket Extra Edge Cases', () => {
  it('should handle broadcast error scenario', () => {
    // Mock console.error
    console.error = vi.fn();
    
    // Create a mock server with clients
    const mockClient1 = new MockWebSocket();
    mockClient1.send = vi.fn(() => { throw new Error('Send error'); });
    
    const mockServer = {
      clients: new Set([mockClient1])
    };
    
    // Create test message
    const message = { type: 'test', data: 'test-data' };
    
    // Call broadcast utility and verify it doesn't crash on error
    expect(() => {
      broadcastMessage(mockServer as unknown as WSServer, message);
    }).not.toThrow();
    
    // Restore console
    console.error = console.error;
  });
  
  it('should handle broadcastToRole with mixed client states', () => {
    // Create a service
    const mockServer = new MockServer();
    const service = new WebSocketService(mockServer as unknown as Server);
    
    // Get the WSServer
    const wss = vi.mocked(WSServer).mock.results[0].value as MockWSServer;
    
    // Create mock clients with different states
    const openTeacher = new MockWebSocket();
    openTeacher.role = 'teacher';
    openTeacher.readyState = WebSocketState.OPEN;
    
    const closingTeacher = new MockWebSocket();
    closingTeacher.role = 'teacher';
    closingTeacher.readyState = WebSocketState.CLOSING;
    
    const openStudent = new MockWebSocket();
    openStudent.role = 'student';
    openStudent.readyState = WebSocketState.OPEN;
    
    // Add all clients
    wss.clients.add(openTeacher);
    wss.clients.add(closingTeacher);
    wss.clients.add(openStudent);
    
    // Broadcast to teachers
    const message = { type: 'teacher-msg', data: 'teacher-data' };
    service.broadcastToRole('teacher', message);
    
    // Verify only open teacher received message
    expect(openTeacher.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(closingTeacher.send).not.toHaveBeenCalled();
    expect(openStudent.send).not.toHaveBeenCalled();
  });
});