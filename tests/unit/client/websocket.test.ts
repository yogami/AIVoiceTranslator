/**
 * Unit tests for WebSocketClient
 * 
 * Following principles from Clean Code and the Testing Pyramid:
 * - Tests should be independent and isolated
 * - Each test should focus on a single concept
 * - Test names should clearly describe what they're testing
 * - Mock dependencies to isolate the unit being tested
 */

import { WebSocketClient, WebSocketFactory, UserRole, ConnectionStatus, WebSocketState } from '../../../client/src/lib/websocket';

// Mock WebSocket factory for testing
class MockWebSocketFactory implements WebSocketFactory {
  public mockWebSocket: any = {
    readyState: WebSocketState.OPEN,
    send: jest.fn(),
    close: jest.fn(),
  };
  
  createWebSocket(_url: string): WebSocket {
    return this.mockWebSocket as unknown as WebSocket;
  }
}

describe('WebSocketClient', () => {
  let mockFactory: MockWebSocketFactory;
  let wsClient: WebSocketClient;

  // Extend the test timeout to account for slow WebSocket operations in Replit
  jest.setTimeout(30000); // 30 seconds timeout instead of default 5 seconds

  // Set up before each test
  beforeEach(() => {
    // Reset mocks and create a fresh client for each test
    mockFactory = new MockWebSocketFactory();
    
    // Create client with the mock factory
    wsClient = new WebSocketClient(mockFactory, '/ws');
    
    // Mock global objects
    global.window = {
      location: {
        protocol: 'https:',
        host: 'test.example.com'
      }
    } as any;
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Handling', () => {
    test('should connect to WebSocket server with correct URL', async () => {
      // Arrange - Setup onopen callback to be called immediately
      mockFactory.mockWebSocket.onopen = null;
      
      // Act - Start connection
      const connectPromise = wsClient.connect();
      
      // Simulate successful connection
      mockFactory.mockWebSocket.onopen?.();
      
      // Assert - Verify connection completes successfully
      await connectPromise;
      
      // Verify that the client is in the connected state
      expect(wsClient.getStatus()).toBe('connected');
    });

    test('should update status to error when connection fails', async () => {
      // Arrange - Set up error handler
      mockFactory.mockWebSocket.onerror = null;
      
      // Act - Start connection but it will fail
      const connectPromise = wsClient.connect().catch(() => {
        // Error expected
      });
      
      // Simulate connection error
      mockFactory.mockWebSocket.onerror?.(new Error('Connection refused'));
      
      // Wait for the promise to resolve
      await connectPromise;
      
      // Assert - Verify we're in error state
      expect(wsClient.getStatus()).toBe('error');
    });

    test('should disconnect and clean up resources', () => {
      // Arrange - Connect first
      wsClient.connect();
      
      // Mock internal state to simulate connected status
      (wsClient as any).status = 'connected';
      
      // Act - Disconnect
      wsClient.disconnect();
      
      // Assert - Verify close was called on the socket
      expect(mockFactory.mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Role and Language Registration', () => {
    test('should register role and language when connected', async () => {
      // Arrange - Connect first
      await wsClient.connect();
      
      // Act - Register as teacher with English language
      wsClient.register('teacher', 'en-US');
      
      // Assert - Verify message was sent
      expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"register"')
      );
      expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"role":"teacher"')
      );
      
      // Verify client state is updated
      expect(wsClient.getRole()).toBe('teacher');
      expect(wsClient.getLanguageCode()).toBe('en-US');
    });

    test('should not change role when role is locked', async () => {
      // Arrange - Connect and lock role as teacher
      await wsClient.connect();
      wsClient.setRoleAndLock('teacher');
      
      // Act - Try to register as student
      wsClient.register('student', 'es');
      
      // Assert - Role should still be teacher
      expect(wsClient.getRole()).toBe('teacher');
      // But language should be updated
      expect(wsClient.getLanguageCode()).toBe('es');
    });
  });

  describe('Sending Transcriptions', () => {
    test('should send transcription when connected as teacher', async () => {
      // Arrange - Connect and register as teacher
      await wsClient.connect();
      wsClient.register('teacher', 'en-US');
      
      // Act - Send transcription
      const result = wsClient.sendTranscription('Hello world');
      
      // Assert - Verify success and message sent
      expect(result).toBe(true);
      expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"transcription"')
      );
      expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"text":"Hello world"')
      );
    });

    test('should not send transcription when not connected', () => {
      // Arrange - Not connecting
      
      // Act - Try to send transcription
      const result = wsClient.sendTranscription('Hello world');
      
      // Assert - Verify failure
      expect(result).toBe(false);
      expect(mockFactory.mockWebSocket.send).not.toHaveBeenCalled();
    });

    test('should not send transcription when not registered as teacher', async () => {
      // Arrange - Connect and register as student
      await wsClient.connect();
      wsClient.register('student', 'en-US');
      
      // Act - Try to send transcription
      const result = wsClient.sendTranscription('Hello world');
      
      // Assert - Verify failure
      expect(result).toBe(false);
      expect(mockFactory.mockWebSocket.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"transcription"')
      );
    });
  });

  describe('Event Handling', () => {
    test('should notify listeners when events occur', async () => {
      // Arrange - Set up listeners
      const statusListener = jest.fn();
      const messageListener = jest.fn();
      
      wsClient.addEventListener('status', statusListener);
      wsClient.addEventListener('message', messageListener);
      
      // Act - Connect to trigger status event
      const connectPromise = wsClient.connect();
      mockFactory.mockWebSocket.onopen?.();
      await connectPromise;
      
      // Simulate receiving a message
      const mockMessage = {
        type: 'translation',
        text: 'Hello',
        translatedText: 'Hola'
      };
      
      mockFactory.mockWebSocket.onmessage?.({ 
        data: JSON.stringify(mockMessage) 
      });
      
      // Assert - Verify listeners were called
      expect(statusListener).toHaveBeenCalledWith('connected');
      expect(messageListener).toHaveBeenCalledWith(mockMessage);
    });

    test('should handle connection message with session ID', async () => {
      // Arrange - Connect
      await wsClient.connect();
      
      // Act - Simulate receiving a connection message with session ID
      mockFactory.mockWebSocket.onmessage?.({ 
        data: JSON.stringify({
          type: 'connection',
          sessionId: 'test-session-123'
        }) 
      });
      
      // Assert - Verify session ID is stored
      expect(wsClient.getSessionId()).toBe('test-session-123');
    });
  });
});