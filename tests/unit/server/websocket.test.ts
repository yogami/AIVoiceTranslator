/**
 * Unit tests for WebSocketService
 * 
 * These tests follow the principles of:
 * - Clean code: Descriptive test names that document functionality
 * - Test isolation: Each test is independent
 * - Single responsibility: Each test focuses on one aspect
 * - Arrange-Act-Assert pattern: Clear setup, execution, and verification
 */

import { 
  WebSocketService, 
  WebSocketState, 
  WebSocketMessage,
  ExtendedWebSocket
} from '../../../server/websocket';
import { EventEmitter } from 'events';
import { Server } from 'http';

// Mock HTTP server
class MockServer extends EventEmitter {
  constructor() {
    super();
  }
}

// Mock WebSocket implementation
class MockWebSocket extends EventEmitter implements Partial<ExtendedWebSocket> {
  isAlive: boolean = true;
  sessionId?: string;
  role?: 'teacher' | 'student';
  languageCode?: string;
  readyState: 0 | 1 | 2 | 3 = WebSocketState.OPEN as 1;
  
  // Mock methods
  send = jest.fn();
  close = jest.fn();
  terminate = jest.fn();
  ping = jest.fn();
  
  constructor() {
    super();
  }
}

// Mock for ws module
jest.mock('ws', () => {
  const WebSocketMock = jest.fn().mockImplementation(() => {
    return new MockWebSocket();
  });
  
  class WebSocketServerMock extends EventEmitter {
    clients: Set<MockWebSocket> = new Set();
    
    constructor() {
      super();
      // Simulate some clients
      this.clients.add(new MockWebSocket());
    }
    
    on(event: string, listener: (...args: any[]) => void) {
      super.on(event, listener);
      return this;
    }
  }
  
  // Return the mocked implementation
  return {
    WebSocket: WebSocketMock,
    WebSocketServer: jest.fn().mockImplementation(() => {
      return new WebSocketServerMock();
    })
  };
});

describe('WebSocketService', () => {
  let mockServer: MockServer;
  let wsService: WebSocketService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = new MockServer();
    wsService = new WebSocketService(mockServer as unknown as Server);
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Connection Handling', () => {
    test('should register connection handler and execute it when client connects', () => {
      // Arrange
      const connectionHandler = jest.fn();
      const mockWs = new MockWebSocket();
      const mockRequest = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
      
      // Act
      wsService.onConnection(connectionHandler);
      
      // Simulate a connection
      const wss = (wsService as any).wss;
      wss.emit('connection', mockWs, mockRequest);
      
      // Assert
      expect(connectionHandler).toHaveBeenCalled();
      expect(connectionHandler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ headers: {} })
      );
    });
    
    test('should send connection confirmation when client connects', () => {
      // Arrange
      const mockWs = new MockWebSocket();
      const mockRequest = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
      
      // Act
      // Simulate a connection
      const wss = (wsService as any).wss;
      wss.emit('connection', mockWs, mockRequest);
      
      // Assert
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connection"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"connected"')
      );
    });
  });
  
  describe('Message Handling', () => {
    test('should register message handler and execute it when message received', () => {
      // Arrange
      const messageHandler = jest.fn();
      const mockWs = new MockWebSocket();
      const mockRequest = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
      const testMessage = { type: 'test', data: 'hello' };
      
      // Act
      wsService.onMessage('test', messageHandler);
      
      // Simulate a connection
      const wss = (wsService as any).wss;
      wss.emit('connection', mockWs, mockRequest);
      
      // Simulate a message
      mockWs.emit('message', Buffer.from(JSON.stringify(testMessage)));
      
      // Assert
      expect(messageHandler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: 'test', data: 'hello' })
      );
    });
    
    test('should update client role and language when register message received', () => {
      // Arrange
      const mockWs = new MockWebSocket();
      const mockRequest = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
      const registerMessage = { 
        type: 'register', 
        role: 'teacher',
        languageCode: 'en-US'
      };
      
      // Act
      // Simulate a connection
      const wss = (wsService as any).wss;
      wss.emit('connection', mockWs, mockRequest);
      
      // Simulate a register message
      mockWs.emit('message', Buffer.from(JSON.stringify(registerMessage)));
      
      // Assert
      expect(mockWs.role).toBe('teacher');
      expect(mockWs.languageCode).toBe('en-US');
    });
    
    test('should handle message parsing errors gracefully', () => {
      // Arrange
      const errorSpy = jest.spyOn(console, 'error');
      const mockWs = new MockWebSocket();
      const mockRequest = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
      
      // Act
      // Simulate a connection
      const wss = (wsService as any).wss;
      wss.emit('connection', mockWs, mockRequest);
      
      // Simulate an invalid message
      mockWs.emit('message', Buffer.from('invalid json'));
      
      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing message:'),
        expect.any(Error)
      );
    });
  });
  
  describe('Broadcasting', () => {
    test('should broadcast message to all connected clients', () => {
      // Arrange
      const testMessage: WebSocketMessage = { 
        type: 'broadcast', 
        text: 'Hello everyone' 
      };
      
      // Act
      wsService.broadcast(testMessage);
      
      // Assert - Get the clients from the mock
      const wss = (wsService as any).wss;
      const firstClient = Array.from(wss.clients)[0] as MockWebSocket;
      
      expect(firstClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"broadcast"')
      );
      expect(firstClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"text":"Hello everyone"')
      );
    });
    
    test('should broadcast message only to clients with specified role', () => {
      // Arrange
      const testMessage: WebSocketMessage = { 
        type: 'roleSpecific', 
        text: 'Teacher message' 
      };
      
      // Set up clients with different roles
      const wss = (wsService as any).wss;
      const teacherClient = new MockWebSocket();
      teacherClient.role = 'teacher';
      
      const studentClient = new MockWebSocket();
      studentClient.role = 'student';
      
      wss.clients.add(teacherClient);
      wss.clients.add(studentClient);
      
      // Act
      wsService.broadcastToRole('teacher', testMessage);
      
      // Assert
      expect(teacherClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"roleSpecific"')
      );
      expect(studentClient.send).not.toHaveBeenCalled();
    });
  });
  
  describe('Client Management', () => {
    test('should get clients by role', () => {
      // Arrange
      const wss = (wsService as any).wss;
      
      // Clear existing clients
      wss.clients.clear();
      
      // Add clients with different roles
      const teacherClient1 = new MockWebSocket();
      teacherClient1.role = 'teacher';
      
      const teacherClient2 = new MockWebSocket();
      teacherClient2.role = 'teacher';
      
      const studentClient = new MockWebSocket();
      studentClient.role = 'student';
      
      wss.clients.add(teacherClient1);
      wss.clients.add(teacherClient2);
      wss.clients.add(studentClient);
      
      // Act
      const teachers = wsService.getClientsByRole('teacher');
      const students = wsService.getClientsByRole('student');
      
      // Assert
      expect(teachers.length).toBe(2);
      expect(students.length).toBe(1);
    });
  });
  
  describe('Heartbeat Mechanism', () => {
    test('should terminate inactive connections', () => {
      // Arrange
      jest.useFakeTimers();
      
      const wss = (wsService as any).wss;
      const inactiveClient = new MockWebSocket();
      inactiveClient.isAlive = false;
      wss.clients.add(inactiveClient);
      
      // Act
      jest.runOnlyPendingTimers(); // Trigger the heartbeat interval
      
      // Assert
      expect(inactiveClient.terminate).toHaveBeenCalled();
      
      // Clean up
      jest.useRealTimers();
    });
    
    test('should mark connections as inactive and send ping', () => {
      // Arrange
      jest.useFakeTimers();
      
      const wss = (wsService as any).wss;
      const activeClient = new MockWebSocket();
      activeClient.isAlive = true;
      wss.clients.add(activeClient);
      
      // Act
      jest.runOnlyPendingTimers(); // Trigger the heartbeat interval
      
      // Assert
      expect(activeClient.isAlive).toBe(false);
      expect(activeClient.ping).toHaveBeenCalled();
      
      // Clean up
      jest.useRealTimers();
    });
  });
});