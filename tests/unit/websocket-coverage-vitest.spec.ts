/**
 * Enhanced WebSocket Coverage Tests - Vitest Version
 * 
 * These tests build on the existing websocket.spec.ts but target untested functionality
 * to maximize coverage. This includes error handling, edge cases, and specific methods
 * that weren't previously covered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketService, WebSocketState, ExtendedWebSocket, createWebSocketServer, broadcastMessage, sendToClient } from '../../server/websocket';
import { Server } from 'http';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';

// Mock WebSocket implementation
vi.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;
  
  // Define types to match the actual WebSocket implementation
  class MockWebSocket extends EventEmitter {
    binaryType = 'arraybuffer' as const;
    bufferedAmount = 0;
    extensions = '';
    protocol = '';
    readyState = WebSocketState.OPEN;
    url = 'ws://localhost:8080/ws';
    
    // Custom properties for our testing
    isAlive = true;
    sessionId?: string = undefined;
    role?: 'teacher' | 'student' = undefined;
    languageCode?: string = undefined;
    throwOnSend = false;
    
    // Mock methods
    send = vi.fn().mockImplementation((data) => {
      if (this.throwOnSend) {
        throw new Error('Mock send error');
      }
      return true;
    });
    
    ping = vi.fn();
    terminate = vi.fn();
    close = vi.fn();
    
    // Event handlers
    onclose = null;
    onerror = null;
    onmessage = null;
    onopen = null;
    
    // Required WebSocket methods
    addEventListener = vi.fn((event, listener) => {
      super.on(event, listener);
    });
    
    removeEventListener = vi.fn((event, listener) => {
      super.off(event, listener);
    });
    
    dispatchEvent = vi.fn();
  }
  
  class MockWSServer extends EventEmitter {
    clients = new Set();
    
    constructor(options = {}) {
      super();
      this.clients.add(new MockWebSocket());
      this.path = options.path || '/ws';
      
      // Handle options.server if provided
      if (options.server) {
        options.server.on('upgrade', (request, socket, head) => {
          this.handleUpgrade(request, socket, head, (ws) => {
            this.emit('connection', ws, request);
          });
        });
      }
    }
    
    // Mock methods
    on = vi.fn((event, callback) => {
      super.on(event, callback);
      return this;
    });
    
    handleUpgrade = vi.fn();
    
    // Broadcast to all clients
    broadcast = vi.fn((data) => {
      this.clients.forEach(client => {
        if (client.readyState === WebSocketState.OPEN) {
          client.send(typeof data === 'string' ? data : JSON.stringify(data));
        }
      });
    });
    
    // Allow direct access for test verification
    triggerConnection(client) {
      this.emit('connection', client);
    }
    
    triggerError(error) {
      this.emit('error', error);
    }
  }
  
  return {
    WebSocket: MockWebSocket,
    WebSocketServer: MockWSServer
  };
});

// Mock HTTP server
vi.mock('http', () => {
  return {
    Server: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      listen: vi.fn(),
      address: vi.fn().mockReturnValue({ port: 8080 })
    }))
  };
});

describe('WebSocket Module - 100% Coverage Tests', () => {
  // Initialize objects needed for tests
  let wsService: WebSocketService;
  let mockServer: Server;
  
  beforeEach(() => {
    // Reset mocks between tests
    vi.clearAllMocks();
    
    // Create new instances
    mockServer = new Server();
    
    // Create WebSocketService with our mock server
    wsService = new WebSocketService(mockServer, { 
      path: '/ws',
      logLevel: 'none' // Suppress logs during tests
    });
  });
  
  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
  });
  
  describe('WebSocketService Class', () => {
    it('should initialize with default parameters', () => {
      const service = new WebSocketService(mockServer);
      expect(service).toBeDefined();
      expect(service.getServer()).toBeDefined();
    });
    
    it('should initialize with custom parameters', () => {
      const service = new WebSocketService(mockServer, {
        path: '/custom',
        heartbeatInterval: 5000,
        logLevel: 'debug'
      });
      expect(service).toBeDefined();
    });
    
    it('should handle onMessage registration', () => {
      const handler = vi.fn();
      
      // Register handler
      wsService.onMessage('test', handler);
      
      // Get the WebSocket server
      const wss = wsService.getServer();
      
      // Create a mock connection
      const mockWs = new WebSocket();
      (mockWs as any).readyState = WebSocketState.OPEN;
      
      // Trigger a connection
      wss.emit('connection', mockWs, {} as IncomingMessage);
      
      // Now trigger a message event with our type
      const mockMessage = { type: 'test', data: 'test data' };
      mockWs.emit('message', Buffer.from(JSON.stringify(mockMessage)));
      
      // Handler should have been called
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          readyState: WebSocketState.OPEN
        }),
        mockMessage
      );
    });
    
    it('should handle onConnection registration', () => {
      const handler = vi.fn();
      
      // Register handler
      wsService.onConnection(handler);
      
      // Get the WebSocket server
      const wss = wsService.getServer();
      
      // Create a mock connection
      const mockWs = new WebSocket();
      const mockRequest = {} as IncomingMessage;
      
      // Trigger a connection
      wss.emit('connection', mockWs, mockRequest);
      
      // Handler should have been called
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          readyState: WebSocketState.OPEN
        }),
        mockRequest
      );
    });
    
    it('should handle onClose registration', () => {
      const handler = vi.fn();
      
      // Register handler
      wsService.onClose(handler);
      
      // Get the WebSocket server
      const wss = wsService.getServer();
      
      // Create a mock connection
      const mockWs = new WebSocket();
      
      // Trigger a connection
      wss.emit('connection', mockWs, {} as IncomingMessage);
      
      // Now close the connection
      mockWs.emit('close', 1000, 'Normal closure');
      
      // Handler should have been called
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          readyState: WebSocketState.OPEN
        }),
        1000,
        'Normal closure'
      );
    });
    
    it('should broadcast messages to all clients', () => {
      // Get server instance and add clients
      const wss = wsService.getServer();
      
      // Create mock clients
      const client1 = new WebSocket();
      const client2 = new WebSocket();
      
      // Add them to clients set
      wss.clients.clear();
      wss.clients.add(client1);
      wss.clients.add(client2);
      
      // Send broadcast
      const message = { type: 'broadcast', data: 'test' };
      wsService.broadcast(message);
      
      // Both clients should receive the message
      expect(client1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(client2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should broadcast messages to clients with specific role', () => {
      // Get server instance
      const wss = wsService.getServer();
      
      // Create mock clients with roles
      const teacher = new WebSocket() as ExtendedWebSocket;
      teacher.role = 'teacher';
      // Note: readyState is already WebSocketState.OPEN in the mock
      
      const student = new WebSocket() as ExtendedWebSocket;
      student.role = 'student';
      
      const noRole = new WebSocket() as ExtendedWebSocket;
      
      // Add them to clients set
      wss.clients.clear();
      wss.clients.add(teacher);
      wss.clients.add(student);
      wss.clients.add(noRole);
      
      // Send targeted broadcast
      const message = { type: 'rolecast', data: 'test' };
      wsService.broadcastToRole('teacher', message);
      
      // Only teacher should receive the message
      expect(teacher.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(student.send).not.toHaveBeenCalled();
      expect(noRole.send).not.toHaveBeenCalled();
    });
    
    it('should get clients by role', () => {
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
      
      // Get teachers
      const teachers = wsService.getClientsByRole('teacher');
      
      // Should find 2 teachers
      expect(teachers.length).toBe(2);
      expect(teachers).toContain(teacher1);
      expect(teachers).toContain(teacher2);
      expect(teachers).not.toContain(student);
    });
    
    it('should get all clients', () => {
      // Get server instance and add clients
      const wss = wsService.getServer();
      
      // Create mock clients
      const client1 = new WebSocket();
      const client2 = new WebSocket();
      
      // Add them to clients set
      wss.clients.clear();
      wss.clients.add(client1);
      wss.clients.add(client2);
      
      // Get all clients
      const clients = wsService.getClients();
      
      // Should have 2 clients
      expect(clients.size).toBe(2);
      expect(clients.has(client1)).toBe(true);
      expect(clients.has(client2)).toBe(true);
    });
    
    it('should handle send errors during broadcast', () => {
      // Get server instance
      const wss = wsService.getServer();
      
      // Create a client that will throw when sending
      const client = new WebSocket();
      client.throwOnSend = true;
      
      // Add to clients set
      wss.clients.clear();
      wss.clients.add(client);
      
      // Should not throw when a client's send method throws
      wsService.broadcast({ type: 'test' });
      
      // Function completes without error
      expect(true).toBeTruthy();
    });

    it('should handle errors when sending messages to clients', () => {
      // Get server instance and add client
      const wss = wsService.getServer();
      
      // Create a client that will throw when sending
      const client = new WebSocket();
      client.throwOnSend = true;
      
      // Add to clients set
      wss.clients.clear();
      wss.clients.add(client);
      
      // Should not throw when a client's send method throws
      wsService.broadcast({ type: 'test' });
      
      // Function completes without error
      expect(true).toBeTruthy();
    });
    
    it('should broadcast messages to all clients', () => {
      // Get server instance and add clients
      const wss = wsService.getServer();
      
      // Create clients
      const client1 = new WebSocket();
      const client2 = new WebSocket();
      
      // Add them to clients set
      wss.clients.clear();
      wss.clients.add(client1);
      wss.clients.add(client2);
      
      // Send broadcast
      const message = { type: 'test', data: 'test-data' };
      wsService.broadcast(message);
      
      // Both clients should receive the message
      expect(client1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(client2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });
  
  describe('createWebSocketServer', () => {
    it('should create a WebSocketService instance', () => {
      const httpServer = new Server();
      const service = createWebSocketServer(httpServer);
      
      expect(service).toBeInstanceOf(WebSocketService);
    });
    
    it('should create WebSocketService with custom path', () => {
      const httpServer = new Server();
      const service = createWebSocketServer(httpServer, '/custom-ws');
      
      expect(service).toBeInstanceOf(WebSocketService);
    });
    

      expect(wsService.clients.size).toBe(1);
      expect(wsService.teachers.size).toBe(1);
      
      // Test student join
      const studentJoin = {
        type: 'join',
        sessionId: 'student-session',
        role: 'student',
        language: 'fr-FR'
      };
      
      // Create a new client for student
      const studentWs = new WebSocket();
      connectionHandler(studentWs);
      
      // Get the message handler for student connection
      const studentMessageHandler = studentWs.on.mock.calls.find(call => call[0] === 'message')[1];
      studentMessageHandler(JSON.stringify(studentJoin));
      
      // Verify student was added
      expect(wsService.clients.size).toBe(2);
      expect(wsService.students.size).toBe(1);
      
      // Test audio message from teacher to students
      const audioMsg = {
        type: 'audio',
        language: 'fr-FR',
        audio: 'base64-audio-data'
      };
      
      messageHandler(JSON.stringify(audioMsg));
      
      // Verify students received the message
      expect(studentWs.send).toHaveBeenCalled();
      
      // Test transcription message
      const transcription = {
        type: 'transcription',
        text: 'Hello world',
        language: 'en-US'
      };
      
      messageHandler(JSON.stringify(transcription));
      
      // Test invalid message handling
      messageHandler('not-json');
      
      // Test unknown message type
      messageHandler(JSON.stringify({ type: 'unknown' }));
      
      // All these should complete without errors
      expect(true).toBeTruthy();
    });
    
    it('should handle connection close events', () => {
      const httpServer = new Server();
      const wsService = new WebSocketService();
      
      // Add spy to removeClient
      const removeClientSpy = vi.spyOn(wsService, 'removeClient');
      
      // Create server and trigger connection
      const wss = createWebSocketServer(httpServer, wsService);
      const mockWs = new WebSocket();
      wss.triggerConnection(mockWs);
      
      // Get close handler
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
      
      // Trigger close
      closeHandler();
      
      // Verify client was removed
      expect(removeClientSpy).toHaveBeenCalledWith(mockWs);
    });
    
    it('should handle connection error events', () => {
      const httpServer = new Server();
      const wsService = new WebSocketService();
      
      // Create server and trigger connection
      const wss = createWebSocketServer(httpServer, wsService);
      const mockWs = new WebSocket();
      wss.triggerConnection(mockWs);
      
      // Get error handler
      const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')[1];
      
      // Trigger error - should not throw
      errorHandler(new Error('Test connection error'));
      
      // If we get here, error was handled
      expect(true).toBeTruthy();
    });
  });
  
  describe('Utility Functions', () => {
    it('should broadcast messages to all clients', () => {
      // Create a proper WSS instance with clients
      const mockWSS = new WSServer({ noServer: true });
      
      // Create real WebSocket instances for the client set
      const client1 = new WebSocket();
      const client2 = new WebSocket();
      
      // Clear the existing Set and add our clients
      mockWSS.clients.clear();
      mockWSS.clients.add(client1);
      mockWSS.clients.add(client2);
      
      // Test broadcast to this server directly
      const message = { type: 'test', data: 'test' };
      broadcastMessage(mockWSS, message);
      
      // Verify messages were sent to clients
      expect(client1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(client2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should send messages to a specific client', () => {
      // Create a mock WebSocket
      const mockClient = new WebSocket();
      
      // Test send
      const message = { type: 'test', data: 'test' };
      sendToClient(mockClient, message);
      
      // Verify client received message
      expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should handle errors when sending to a specific client', () => {
      // Create a mock client
      const mockClient = new WebSocket();
      
      // Force it to throw on send
      mockClient.throwOnSend = true;
      
      // Should not throw
      sendToClient(mockClient, { type: 'test' });
      
      // If we get here, error was handled
      expect(true).toBeTruthy();
    });
  });
});