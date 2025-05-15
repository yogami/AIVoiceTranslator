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
    setSendError(error) {
      this.send.mockImplementation(() => {
        throw error;
      });
    }
    
    reset() {
      this.send.mockReset();
      this.ping.mockReset();
      this.terminate.mockReset();
    }
  }
  
  // Use a factory function to create our mock WebSocketServer
  class MockWSServer extends EventEmitter {
    clients = new Set();
    
    constructor() {
      super();
      // Add initial mock client
      this.addMockClient();
    }
    
    addMockClient(options = {}) {
      const mockClient = new MockWebSocket();
      Object.assign(mockClient, options);
      this.clients.add(mockClient);
      return mockClient;
    }
    
    removeMockClient(client) {
      this.clients.delete(client);
    }
    
    clearClients() {
      this.clients.clear();
    }
  }
  
  return {
    WebSocket: MockWebSocket,
    WebSocketServer: vi.fn().mockImplementation(() => new MockWSServer())
  };
});

describe('WebSocketService with 100% coverage', () => {
  let mockServer;
  let mockWsServer;
  let webSocketService;
  
  beforeEach(() => {
    // Create mock HTTP server
    mockServer = new EventEmitter();
    mockServer.listen = vi.fn().mockReturnValue(mockServer);
    
    // Create WebSocketService using the mock HTTP server
    webSocketService = new WebSocketService(mockServer as unknown as Server, {
      logLevel: 'debug',
      heartbeatInterval: 10000
    });
    
    // Get reference to internal mock WSServer
    mockWsServer = (webSocketService as any).wss;
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up
    if (webSocketService) {
      webSocketService['cleanup']();
    }
  });
  
  describe('Basic functionality', () => {
    it('should create a WebSocketService with default config options', () => {
      const newService = new WebSocketService(mockServer as unknown as Server);
      expect(newService).toBeDefined();
      expect(newService['config'].logLevel).toBe('info');
      expect(newService['config'].heartbeatInterval).toBe(30000);
    });
    
    it('should allow registration of message handlers by type', () => {
      const handler = vi.fn();
      webSocketService.onMessage('test-message', handler);
      
      // Verify handler was registered
      expect(webSocketService['messageHandlers'].has('test-message')).toBe(true);
      expect(webSocketService['messageHandlers'].get('test-message')).toContain(handler);
    });
    
    it('should allow registration of connection handlers', () => {
      const handler = vi.fn();
      webSocketService.onConnection(handler);
      
      // Verify handler was registered
      expect(webSocketService['connectionHandlers']).toContain(handler);
    });
    
    it('should allow registration of close handlers', () => {
      const handler = vi.fn();
      webSocketService.onClose(handler);
      
      // Verify handler was registered
      expect(webSocketService['closeHandlers']).toContain(handler);
    });
  });
  
  describe('Event handling', () => {
    it('should handle connection events and trigger registered handlers', () => {
      // Register a connection handler
      const connectionHandler = vi.fn();
      webSocketService.onConnection(connectionHandler);
      
      // Simulate a connection
      const mockClient = new WebSocket();
      const mockRequest = { url: '/test' };
      mockWsServer.emit('connection', mockClient, mockRequest);
      
      // Verify the handler was called
      expect(connectionHandler).toHaveBeenCalled();
      expect(connectionHandler).toHaveBeenCalledWith(mockClient, mockRequest);
    });
    
    it('should handle close events and trigger registered handlers', () => {
      // Register a close handler
      const closeHandler = vi.fn();
      webSocketService.onClose(closeHandler);
      
      // Get a mock client
      const mockClient = mockWsServer.clients.values().next().value;
      
      // Simulate a close event
      mockClient.emit('close', 1000, 'Normal closure');
      
      // Verify the handler was called
      expect(closeHandler).toHaveBeenCalled();
      expect(closeHandler).toHaveBeenCalledWith(
        expect.anything(),
        1000,
        'Normal closure'
      );
    });
    
    it('should handle message events and trigger registered type-specific handlers', () => {
      // Register a message handler for a specific type
      const messageHandler = vi.fn();
      webSocketService.onMessage('test-type', messageHandler);
      
      // Get a mock client
      const mockClient = mockWsServer.clients.values().next().value;
      
      // Simulate a message event with JSON
      const messageData = JSON.stringify({ type: 'test-type', data: 'test-data' });
      mockClient.emit('message', messageData);
      
      // Verify the handler was called
      expect(messageHandler).toHaveBeenCalled();
      expect(messageHandler).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ type: 'test-type', data: 'test-data' })
      );
    });
    
    it('should handle invalid JSON in message events', () => {
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Get a mock client
      const mockClient = mockWsServer.clients.values().next().value;
      
      // Simulate a message event with invalid JSON
      mockClient.emit('message', 'this is not valid JSON');
      
      // Verify the error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle messages with missing type property', () => {
      // Spy on console.warn
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Get a mock client
      const mockClient = mockWsServer.clients.values().next().value;
      
      // Simulate a message event with missing type
      mockClient.emit('message', JSON.stringify({ data: 'test-data' }));
      
      // Verify the warning was logged
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });
    
    it('should handle messages with no registered handlers for the type', () => {
      // Get a mock client
      const mockClient = mockWsServer.clients.values().next().value;
      
      // Simulate a message event with a type that has no handlers
      mockClient.emit('message', JSON.stringify({ type: 'unhandled-type', data: 'test-data' }));
      
      // This test passes if no error is thrown
      expect(true).toBe(true);
    });
    
    it('should handle errors in message handlers', () => {
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Register a message handler that throws an error
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      webSocketService.onMessage('error-type', errorHandler);
      
      // Get a mock client
      const mockClient = mockWsServer.clients.values().next().value;
      
      // Simulate a message event
      mockClient.emit('message', JSON.stringify({ type: 'error-type', data: 'test-data' }));
      
      // Verify the handler was called and the error was caught
      expect(errorHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('Messaging and broadcast', () => {
    it('should broadcast messages to all clients', () => {
      // Add multiple clients
      const client1 = mockWsServer.clients.values().next().value;
      const client2 = mockWsServer.addMockClient();
      const client3 = mockWsServer.addMockClient();
      
      // Broadcast a message
      const message = { type: 'broadcast-test', data: 'test-data' };
      webSocketService.broadcast(message);
      
      // Verify all clients received the message
      expect(client1.send).toHaveBeenCalled();
      expect(client2.send).toHaveBeenCalled();
      expect(client3.send).toHaveBeenCalled();
      
      // Verify the message format
      expect(client1.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should broadcast messages only to clients with a specific role', () => {
      // Add multiple clients with different roles
      const client1 = mockWsServer.clients.values().next().value;
      client1.role = 'teacher';
      
      const client2 = mockWsServer.addMockClient({ role: 'student' });
      const client3 = mockWsServer.addMockClient({ role: 'teacher' });
      
      // Broadcast a message to teachers only
      const message = { type: 'role-broadcast-test', data: 'test-data' };
      webSocketService.broadcastToRole('teacher', message);
      
      // Verify only teacher clients received the message
      expect(client1.send).toHaveBeenCalled();
      expect(client2.send).not.toHaveBeenCalled();
      expect(client3.send).toHaveBeenCalled();
    });
    
    it('should send messages to a specific client', () => {
      // Add multiple clients
      const client1 = mockWsServer.clients.values().next().value;
      const client2 = mockWsServer.addMockClient();
      
      // Send a message to client2 only
      const message = { type: 'direct-test', data: 'test-data' };
      webSocketService.sendToClient(client2 as any, message);
      
      // Verify only client2 received the message
      expect(client1.send).not.toHaveBeenCalled();
      expect(client2.send).toHaveBeenCalled();
      expect(client2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should handle errors when sending to a client', () => {
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Get a client and set it to throw on send()
      const client = mockWsServer.clients.values().next().value;
      client.setSendError(new Error('Send failed'));
      
      // Attempt to send a message
      const message = { type: 'error-test', data: 'test-data' };
      webSocketService.sendToClient(client as any, message);
      
      // Verify the error was caught and logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('Client management', () => {
    it('should get all connected clients', () => {
      // Add a couple more clients
      mockWsServer.addMockClient();
      mockWsServer.addMockClient();
      
      // Get clients
      const clients = webSocketService.getClients();
      
      // Verify we get all clients
      expect(clients.size).toBe(3);
    });
    
    it('should get clients with a specific role', () => {
      // Add clients with different roles
      const client1 = mockWsServer.clients.values().next().value;
      client1.role = 'teacher';
      
      mockWsServer.addMockClient({ role: 'student' });
      mockWsServer.addMockClient({ role: 'teacher' });
      mockWsServer.addMockClient({ role: 'student' });
      
      // Get teacher clients
      const teacherClients = webSocketService.getClientsByRole('teacher');
      
      // Verify we get only teacher clients
      expect(teacherClients.length).toBe(2);
      expect(teacherClients[0].role).toBe('teacher');
      expect(teacherClients[1].role).toBe('teacher');
    });
  });
  
  describe('Heartbeat and connection management', () => {
    it('should handle heartbeat interval', () => {
      // Use vi.useFakeTimers() for testing timers
      vi.useFakeTimers();
      
      // Create a new service with a shorter heartbeat interval
      const heartbeatService = new WebSocketService(mockServer as unknown as Server, {
        heartbeatInterval: 1000
      });
      
      // Get the wss from the service
      const wss = (heartbeatService as any).wss;
      
      // Add a few clients
      const client1 = wss.addMockClient({ isAlive: true });
      const client2 = wss.addMockClient({ isAlive: false });
      
      // Advance clock to trigger a heartbeat
      vi.advanceTimersByTime(1000);
      
      // Verify ping was called on all clients and isAlive was reset
      expect(client1.ping).toHaveBeenCalled();
      expect(client2.ping).toHaveBeenCalled();
      expect(client1.isAlive).toBe(false);
      expect(client2.isAlive).toBe(false);
      
      // Clean up
      heartbeatService['cleanup']();
      vi.useRealTimers();
    });
    
    it('should terminate inactive clients on heartbeat', () => {
      // Use vi.useFakeTimers() for testing timers
      vi.useFakeTimers();
      
      // Create a new service with a shorter heartbeat interval
      const heartbeatService = new WebSocketService(mockServer as unknown as Server, {
        heartbeatInterval: 1000
      });
      
      // Get the wss from the service
      const wss = (heartbeatService as any).wss;
      
      // Add clients, one already marked as not alive
      const client1 = wss.addMockClient({ isAlive: true });
      const client2 = wss.addMockClient({ isAlive: false });
      
      // First heartbeat - set isAlive to false for all
      vi.advanceTimersByTime(1000);
      
      // Manually mark client1 as alive (simulating a pong response)
      client1.isAlive = true;
      
      // Second heartbeat - should terminate clients that didn't respond
      vi.advanceTimersByTime(1000);
      
      // Verify client2 was terminated but client1 was not
      expect(client1.terminate).not.toHaveBeenCalled();
      expect(client2.terminate).toHaveBeenCalled();
      
      // Clean up
      heartbeatService['cleanup']();
      vi.useRealTimers();
    });
    
    it('should handle pong events to mark clients as alive', () => {
      // Get a client
      const client = mockWsServer.clients.values().next().value;
      
      // Set isAlive to false
      client.isAlive = false;
      
      // Simulate a pong event
      client.emit('pong');
      
      // Verify isAlive was set to true
      expect(client.isAlive).toBe(true);
    });
  });
  
  describe('Logging', () => {
    it('should log at different levels based on configuration', () => {
      // Spy on console methods
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create services with different log levels
      const noneService = new WebSocketService(mockServer as unknown as Server, { logLevel: 'none' });
      const errorService = new WebSocketService(mockServer as unknown as Server, { logLevel: 'error' });
      const warnService = new WebSocketService(mockServer as unknown as Server, { logLevel: 'warn' });
      const infoService = new WebSocketService(mockServer as unknown as Server, { logLevel: 'info' });
      const debugService = new WebSocketService(mockServer as unknown as Server, { logLevel: 'debug' });
      
      // Test logging at each level
      (noneService as any).log('debug', 'Debug message');
      (noneService as any).log('info', 'Info message');
      (noneService as any).log('warn', 'Warn message');
      (noneService as any).log('error', 'Error message');
      
      (errorService as any).log('debug', 'Debug message');
      (errorService as any).log('info', 'Info message');
      (errorService as any).log('warn', 'Warn message');
      (errorService as any).log('error', 'Error message');
      
      (warnService as any).log('debug', 'Debug message');
      (warnService as any).log('info', 'Info message');
      (warnService as any).log('warn', 'Warn message');
      (warnService as any).log('error', 'Error message');
      
      (infoService as any).log('debug', 'Debug message');
      (infoService as any).log('info', 'Info message');
      (infoService as any).log('warn', 'Warn message');
      (infoService as any).log('error', 'Error message');
      
      (debugService as any).log('debug', 'Debug message');
      (debugService as any).log('info', 'Info message');
      (debugService as any).log('warn', 'Warn message');
      (debugService as any).log('error', 'Error message');
      
      // Verify each service only logs at appropriate levels
      // 'none' doesn't log anything
      expect(debugSpy).toHaveBeenCalledTimes(1); // Only from 'debug' level
      expect(infoSpy).toHaveBeenCalledTimes(2);  // From 'debug' and 'info' levels
      expect(warnSpy).toHaveBeenCalledTimes(3);  // From 'debug', 'info', and 'warn' levels
      expect(errorSpy).toHaveBeenCalledTimes(4); // From all levels except 'none'
      
      // Clean up
      debugSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      
      noneService['cleanup']();
      errorService['cleanup']();
      warnService['cleanup']();
      infoService['cleanup']();
      debugService['cleanup']();
    });
  });
  
  describe('Factory functions and legacy support', () => {
    it('should create a WebSocketService using the factory function', () => {
      const service = createWebSocketServer(mockServer as unknown as Server, '/custom-path');
      expect(service).toBeInstanceOf(WebSocketService);
      expect(service['config'].path).toBe('/custom-path');
      service['cleanup']();
    });
    
    it('should broadcast messages using the legacy function', () => {
      // Create several clients
      const client1 = mockWsServer.clients.values().next().value;
      const client2 = mockWsServer.addMockClient();
      
      // Use the legacy broadcast function
      broadcastMessage(mockWsServer, { type: 'legacy-broadcast', data: 'test' });
      
      // Verify all clients received the message
      expect(client1.send).toHaveBeenCalled();
      expect(client2.send).toHaveBeenCalled();
    });
    
    it('should broadcast messages using the legacy function with WebSocketService', () => {
      // Create a client
      const client = mockWsServer.clients.values().next().value;
      
      // Use the legacy broadcast function with a WebSocketService
      broadcastMessage(webSocketService, { type: 'legacy-service-broadcast', data: 'test' });
      
      // Verify client received the message
      expect(client.send).toHaveBeenCalled();
    });
    
    it('should send messages to a client using the legacy function', () => {
      // Create a client
      const client = mockWsServer.clients.values().next().value;
      
      // Use the legacy send function
      sendToClient(client as any, { type: 'legacy-send', data: 'test' });
      
      // Verify client received the message
      expect(client.send).toHaveBeenCalled();
    });
    
    it('should handle errors when sending to a client using the legacy function', () => {
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create a client that throws when send is called
      const client = mockWsServer.clients.values().next().value;
      client.setSendError(new Error('Legacy send failed'));
      
      // Use the legacy send function
      sendToClient(client as any, { type: 'legacy-send-error', data: 'test' });
      
      // Verify error was caught and logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
});