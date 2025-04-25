/**
 * Tests for WebSocketClient
 * 
 * This tests the WebSocket client that handles communication between teacher and students
 */
import { WebSocketClient } from '../../../client/src/services/WebSocketClient';

// Mock WebSocket implementation
class MockWebSocket implements Partial<WebSocket> {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  
  // Event handlers
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  // Mock implementation
  send = jest.fn();
  close = jest.fn();
  
  constructor(url: string) {
    this.url = url;
  }
  
  // Helper to simulate connection established
  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }
  
  // Helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      const messageEvent = {
        data: typeof data === 'string' ? data : JSON.stringify(data),
      } as MessageEvent;
      this.onmessage(messageEvent);
    }
  }
  
  // Helper to simulate connection closed
  simulateClose() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// Save original implementation and setup mock
let originalWebSocket: any;
beforeEach(() => {
  originalWebSocket = global.WebSocket;
  global.WebSocket = MockWebSocket as any;
});

// Restore original after tests
afterEach(() => {
  global.WebSocket = originalWebSocket;
});

describe('WebSocketClient', () => {
  test('should create an instance', () => {
    const client = new WebSocketClient();
    expect(client).toBeDefined();
  });
  
  test('should connect to the WebSocket server', () => {
    const client = new WebSocketClient();
    client.connect();
    
    // Verify the WebSocket was created with the correct URL
    expect(client['socket']).toBeDefined();
    expect(client['socket']?.url).toContain('/ws');
    
    // Default role should be unset until server confirms
    expect(client.getRole()).toBe('unset');
  });
  
  test('should register role and language', () => {
    const client = new WebSocketClient();
    client.connect();
    
    // Simulate connection open
    const mockSocket = client['socket'] as MockWebSocket;
    mockSocket.simulateOpen();
    
    // Register as teacher
    client.register('teacher', 'en-US');
    
    // Verify message was sent
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"register"')
    );
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"role":"teacher"')
    );
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"languageCode":"en-US"')
    );
  });
  
  test('should send audio data', () => {
    const client = new WebSocketClient();
    client.connect();
    
    // Simulate connection open
    const mockSocket = client['socket'] as MockWebSocket;
    mockSocket.simulateOpen();
    
    // Register first
    client.register('teacher', 'en-US');
    
    // Send audio data
    const audioData = 'base64encodedaudio';
    client.sendAudio(audioData);
    
    // Verify audio message was sent
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"audio"')
    );
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining(audioData)
    );
  });
  
  test('should receive and emit messages from server', () => {
    const client = new WebSocketClient();
    
    // Setup event listener
    const translationListener = jest.fn();
    client.addEventListener('translation', translationListener);
    
    // Connect
    client.connect();
    
    // Simulate connection open
    const mockSocket = client['socket'] as MockWebSocket;
    mockSocket.simulateOpen();
    
    // Simulate receiving a translation message
    mockSocket.simulateMessage({
      type: 'translation',
      data: {
        originalText: 'Hello',
        translatedText: 'Hola',
        languageCode: 'es-ES'
      }
    });
    
    // Verify event was emitted to listener
    expect(translationListener).toHaveBeenCalledWith({
      type: 'translation',
      data: {
        originalText: 'Hello',
        translatedText: 'Hola',
        languageCode: 'es-ES'
      }
    });
  });
  
  test('should disconnect from server', () => {
    const client = new WebSocketClient();
    client.connect();
    
    // Simulate connection open
    const mockSocket = client['socket'] as MockWebSocket;
    mockSocket.simulateOpen();
    
    // Disconnect
    client.disconnect();
    
    // Verify socket was closed
    expect(mockSocket.close).toHaveBeenCalled();
  });
});