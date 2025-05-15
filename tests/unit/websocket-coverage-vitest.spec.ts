/**
 * Enhanced WebSocket Coverage Tests - Vitest Version
 * 
 * These tests build on the existing websocket.spec.ts but target untested functionality
 * to maximize coverage. This includes error handling, edge cases, and specific methods
 * that weren't previously covered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketService, WebSocketState, createWebSocketServer, broadcastMessage, sendToClient } from '../../server/websocket';
import { Server } from 'http';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';

// Mock WebSocket implementation
vi.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;
  
  // Define types to match the actual WebSocket implementation
  class MockWebSocket extends EventEmitter {
    binaryType = 'arraybuffer';
    bufferedAmount = 0;
    extensions = '';
    protocol = '';
    readyState = WebSocketState.OPEN;
    url = 'ws://localhost:8080/ws';
    
    // Custom properties for our testing
    isAlive = true;
    sessionId = undefined;
    role = undefined;
    languageCode = undefined;
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
    it('should initialize with default values', () => {
      expect(wsService.clients.size).toBe(0);
      expect(wsService.teachers.size).toBe(0);
      expect(wsService.students.size).toBe(0);
    });
    
    it('should add clients with addClient method', () => {
      const mockWs = new WebSocket();
      const sessionId = 'test-session';
      const role = 'teacher';
      const language = 'en-US';
      
      wsService.addClient(mockWs, sessionId, role, language);
      
      expect(wsService.clients.size).toBe(1);
      expect(wsService.teachers.size).toBe(1);
      expect(wsService.students.size).toBe(0);
      expect(mockWs.sessionId).toBe(sessionId);
      expect(mockWs.role).toBe(role);
      expect(mockWs.languageCode).toBe(language);
    });
    
    it('should add student clients correctly', () => {
      const mockWs = new WebSocket();
      wsService.addClient(mockWs, 'student-session', 'student', 'es-ES');
      
      expect(wsService.clients.size).toBe(1);
      expect(wsService.teachers.size).toBe(0);
      expect(wsService.students.size).toBe(1);
    });
    
    it('should remove clients with removeClient method', () => {
      const mockWs = new WebSocket();
      wsService.addClient(mockWs, 'test-session', 'teacher', 'en-US');
      
      expect(wsService.clients.size).toBe(1);
      
      wsService.removeClient(mockWs);
      
      expect(wsService.clients.size).toBe(0);
      expect(wsService.teachers.size).toBe(0);
    });

    it('should handle removing a client that is not in the collections', () => {
      const mockWs = new WebSocket();
      
      // Client not added to service
      wsService.removeClient(mockWs);
      
      // Should not throw and collections should be empty
      expect(wsService.clients.size).toBe(0);
    });
    
    it('should broadcast messages to teachers', () => {
      // Add multiple teacher clients
      const teacher1 = new WebSocket();
      const teacher2 = new WebSocket();
      
      wsService.addClient(teacher1, 'teacher-1', 'teacher', 'en-US');
      wsService.addClient(teacher2, 'teacher-2', 'teacher', 'fr-FR');
      
      const message = { type: 'test', data: 'test-data' };
      wsService.broadcastToTeachers(message);
      
      expect(teacher1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(teacher2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should broadcast messages to students with language filtering', () => {
      // Add multiple student clients with different languages
      const student1 = new WebSocket();
      const student2 = new WebSocket();
      const student3 = new WebSocket();
      
      wsService.addClient(student1, 'student-1', 'student', 'en-US');
      wsService.addClient(student2, 'student-2', 'student', 'fr-FR');
      wsService.addClient(student3, 'student-3', 'student', 'en-US');
      
      const message = { type: 'test', data: 'test-data' };
      
      // Broadcast only to English students
      wsService.broadcastToStudentsByLanguage(message, 'en-US');
      
      expect(student1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(student2.send).not.toHaveBeenCalled();
      expect(student3.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should handle errors when broadcasting to students by language', () => {
      const student = new WebSocket();
      student.throwOnSend = true;
      wsService.addClient(student, 'student-error', 'student', 'en-US');
      
      // Should not throw when a client's send method throws
      wsService.broadcastToStudentsByLanguage({ type: 'test' }, 'en-US');
      
      // Function completes without error
      expect(true).toBeTruthy();
    });
    
    it('should handle errors when broadcasting to teachers', () => {
      const teacher = new WebSocket();
      teacher.throwOnSend = true;
      wsService.addClient(teacher, 'teacher-error', 'teacher', 'en-US');
      
      // Should not throw when a client's send method throws
      wsService.broadcastToTeachers({ type: 'test' });
      
      // Function completes without error
      expect(true).toBeTruthy();
    });

    it('should handle errors when broadcasting to all clients', () => {
      const client = new WebSocket();
      client.throwOnSend = true;
      wsService.addClient(client, 'client-error', 'student', 'en-US');
      
      // Should not throw when a client's send method throws
      wsService.broadcastToAll({ type: 'test' });
      
      // Function completes without error
      expect(true).toBeTruthy();
    });
    
    it('should broadcast messages to all clients', () => {
      const teacher = new WebSocket();
      const student = new WebSocket();
      
      wsService.addClient(teacher, 'teacher-1', 'teacher', 'en-US');
      wsService.addClient(student, 'student-1', 'student', 'fr-FR');
      
      const message = { type: 'test', data: 'test-data' };
      wsService.broadcastToAll(message);
      
      expect(teacher.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(student.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });
  
  describe('WebSocket Server Creation', () => {
    it('should create a WebSocket server and attach event handlers', () => {
      const httpServer = new Server();
      const wsService = new WebSocketService();
      
      const wss = createWebSocketServer(httpServer, wsService);
      
      // Check if server has connection handler
      expect(wss.on).toHaveBeenCalledWith('connection', expect.any(Function));
      
      // Trigger connection and error events to test handlers
      const mockWs = new WebSocket();
      wss.triggerConnection(mockWs);
      
      // Verify event listeners were added to the socket
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      
      // Trigger error event
      const testError = new Error('Test server error');
      wss.triggerError(testError);
      
      // Verify server is handling errors (no assertion needed - just checking it doesn't throw)
      expect(true).toBeTruthy();
    });
    
    it('should handle connection message events correctly', () => {
      const httpServer = new Server();
      const wsService = new WebSocketService();
      
      // Create server and capture connection handler
      const wss = createWebSocketServer(httpServer, wsService);
      const connectionHandler = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      
      // Create client and attach message handler
      const mockWs = new WebSocket();
      connectionHandler(mockWs);
      
      // Extract message handler
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      
      // Test join message handling - teacher
      const teacherJoin = {
        type: 'join',
        sessionId: 'teacher-session',
        role: 'teacher',
        language: 'en-US'
      };
      
      messageHandler(JSON.stringify(teacherJoin));
      
      // Verify client was added
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