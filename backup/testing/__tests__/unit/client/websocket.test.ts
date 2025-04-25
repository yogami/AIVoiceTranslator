import { WebSocketClient, WebSocketStatus, UserRole } from '../../../client/src/lib/websocket';

// Mock the WebSocket class
const mockWebSocketInstance = {
  url: '',
  readyState: 0,
  send: jest.fn(),
  close: jest.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null,
};

// Mock the WebSocket constructor
global.WebSocket = jest.fn().mockImplementation((url) => {
  mockWebSocketInstance.url = url;
  return mockWebSocketInstance;
}) as unknown as typeof WebSocket;

// Add WebSocket constants
WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset the mockWebSocketInstance state
    mockWebSocketInstance.readyState = WebSocket.CONNECTING;
    mockWebSocketInstance.onopen = null;
    mockWebSocketInstance.onclose = null;
    mockWebSocketInstance.onmessage = null;
    mockWebSocketInstance.onerror = null;
    
    // Create a new client instance for each test
    client = new WebSocketClient();
  });
  
  describe('connect', () => {
    test('should create a new WebSocket connection', () => {
      // Arrange
      const expectedUrl = expect.stringContaining('/ws');
      
      // Act
      client.connect();
      
      // Assert
      expect(WebSocket).toHaveBeenCalledWith(expectedUrl);
      expect(client.getStatus()).toBe('connecting');
    });
    
    test('should update status to connected when connection opens', () => {
      // Arrange
      const messageListener = jest.fn();
      client.addEventListener('connect', messageListener);
      
      // Act
      client.connect();
      
      // Simulate the connection opening
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      
      // Assert
      expect(client.getStatus()).toBe('connected');
      expect(messageListener).toHaveBeenCalled();
    });
    
    test('should handle connection errors', () => {
      // Arrange
      const errorListener = jest.fn();
      client.addEventListener('error', errorListener);
      
      // Act
      client.connect();
      
      // Simulate an error
      if (mockWebSocketInstance.onerror) {
        mockWebSocketInstance.onerror({ error: 'Connection error' });
      }
      
      // Assert
      expect(client.getStatus()).toBe('disconnected');
      expect(errorListener).toHaveBeenCalled();
    });
  });
  
  describe('disconnect', () => {
    test('should close the WebSocket connection', () => {
      // Arrange
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      
      // Act
      client.disconnect();
      
      // Assert
      expect(mockWebSocketInstance.close).toHaveBeenCalled();
    });
    
    test('should not try to close if not connected', () => {
      // Act
      client.disconnect();
      
      // Assert
      expect(mockWebSocketInstance.close).not.toHaveBeenCalled();
    });
  });
  
  describe('send', () => {
    test('should send a message when connected', () => {
      // Arrange
      const message = { type: 'test', payload: { data: 'test' } };
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      
      // Act
      const result = client.send(message);
      
      // Assert
      expect(result).toBe(true);
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    test('should not send if not connected', () => {
      // Arrange
      const message = { type: 'test', payload: { data: 'test' } };
      
      // Act
      const result = client.send(message);
      
      // Assert
      expect(result).toBe(false);
      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });
    
    test('should handle send errors', () => {
      // Arrange
      const message = { type: 'test', payload: { data: 'test' } };
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      mockWebSocketInstance.send.mockImplementationOnce(() => {
        throw new Error('Send error');
      });
      
      // Act
      const result = client.send(message);
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('sendAudio', () => {
    test('should send audio data with the correct message format', () => {
      // Arrange
      const audioData = 'base64-encoded-audio-data';
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      
      // Act
      client.sendAudio(audioData);
      
      // Assert
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"audio"')
      );
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        expect.stringContaining(audioData)
      );
    });
  });
  
  describe('sendTranscription', () => {
    test('should send transcription text with the correct message format', () => {
      // Arrange
      const text = 'test transcription';
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      
      // Act
      client.sendTranscription(text);
      
      // Assert
      // Should send both webSpeechTranscription and transcription messages
      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(2);
      
      // First call should be webSpeechTranscription
      const firstCallArg = mockWebSocketInstance.send.mock.calls[0][0];
      expect(firstCallArg).toContain('"type":"webSpeechTranscription"');
      expect(firstCallArg).toContain('"text":"' + text + '"');
      
      // Second call should be transcription
      const secondCallArg = mockWebSocketInstance.send.mock.calls[1][0];
      expect(secondCallArg).toContain('"type":"transcription"');
      expect(secondCallArg).toContain('"text":"' + text + '"');
    });
  });
  
  describe('register', () => {
    test('should send a register message with the correct role and language', () => {
      // Arrange
      const role: UserRole = 'teacher';
      const language = 'en-US';
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      
      // Act
      client.register(role, language);
      
      // Assert
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"register"')
      );
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"role":"teacher"')
      );
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"languageCode":"en-US"')
      );
    });
    
    test('should lock the role when registering as teacher', () => {
      // Arrange
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      
      // Act
      client.register('teacher', 'en-US');
      
      // Assert
      expect(client.isRoleLocked).toBe(true);
      expect(client.currentRole).toBe('teacher');
    });
    
    test('should not change role when locked', () => {
      // Arrange
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      client.register('teacher', 'en-US'); // Lock as teacher
      
      // Act
      client.register('student', 'es-ES'); // Try to change to student
      
      // Assert
      expect(client.currentRole).toBe('teacher'); // Should still be teacher
      expect(client.isRoleLocked).toBe(true);
    });
    
    test('should update language even when role is locked', () => {
      // Arrange
      client.connect();
      mockWebSocketInstance.readyState = WebSocket.OPEN;
      client.register('teacher', 'en-US'); // Lock as teacher with English
      
      // Act
      client.register('student', 'es-ES'); // Try to change to student with Spanish
      
      // Assert
      expect(client.currentRole).toBe('teacher'); // Should still be teacher
      const sendArg = mockWebSocketInstance.send.mock.calls[1][0];
      expect(sendArg).toContain('"languageCode":"es-ES"'); // But language should be Spanish
    });
  });
  
  describe('event listeners', () => {
    test('should add and call event listeners', () => {
      // Arrange
      const listener = jest.fn();
      const eventType = 'testEvent';
      const eventData = { test: 'data' };
      
      // Act
      client.addEventListener(eventType, listener);
      
      // Manually trigger the event using a private method
      // @ts-ignore - Access private method for testing
      client.notifyListeners(eventType, eventData);
      
      // Assert
      expect(listener).toHaveBeenCalledWith(eventData);
    });
    
    test('should remove event listeners', () => {
      // Arrange
      const listener = jest.fn();
      const eventType = 'testEvent';
      
      // Act
      client.addEventListener(eventType, listener);
      client.removeEventListener(eventType, listener);
      
      // Manually trigger the event using a private method
      // @ts-ignore - Access private method for testing
      client.notifyListeners(eventType, {});
      
      // Assert
      expect(listener).not.toHaveBeenCalled();
    });
  });
  
  describe('message handling', () => {
    test('should handle incoming messages and notify listeners', () => {
      // Arrange
      const messageListener = jest.fn();
      const translationListener = jest.fn();
      const message = {
        type: 'translation',
        payload: { text: 'translated text' }
      };
      
      client.connect();
      client.addEventListener('message', messageListener);
      client.addEventListener('translation', translationListener);
      
      // Act - simulate receiving a message
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(message)
        });
      }
      
      // Assert
      expect(messageListener).toHaveBeenCalled();
      expect(translationListener).toHaveBeenCalled();
    });
    
    test('should handle malformed JSON messages', () => {
      // Arrange
      const errorListener = jest.fn();
      client.connect();
      client.addEventListener('error', errorListener);
      
      // Act - simulate receiving a malformed message
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({
          data: 'not-valid-json'
        });
      }
      
      // Assert
      expect(errorListener).toHaveBeenCalled();
    });
  });
  
  describe('session management', () => {
    test('should store session ID after connecting', () => {
      // Arrange
      const sessionId = 'test-session-id';
      client.connect();
      
      // Act - simulate server sending session confirmation
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify({
            type: 'connect',
            sessionId
          })
        });
      }
      
      // Assert
      expect(client.getSessionId()).toBe(sessionId);
    });
  });
});