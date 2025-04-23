/**
 * Unit tests for WebSocketClient
 */
import { webSocketClient, WebSocketMessage, UserRole, ConnectionStatus, WebSocketClient } from '../../../client/src/lib/websocket';

// Mock WebSocket implementation
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data: string) {
    // Store sent data for test verification
    MockWebSocket.sentMessages.push(data);
  }
  
  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  }
  
  // Helper methods for testing
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }
  
  simulateError(error: any) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
  
  simulateClose(code: number = 1000, reason: string = '') {
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
  
  static sentMessages: string[] = [];
  
  static reset() {
    MockWebSocket.instances = [];
    MockWebSocket.sentMessages = [];
  }
}

// Define WebSocket as our mock for tests
(global as any).WebSocket = MockWebSocket;
(global as any).WebSocket.CONNECTING = 0;
(global as any).WebSocket.OPEN = 1;
(global as any).WebSocket.CLOSING = 2;
(global as any).WebSocket.CLOSED = 3;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    host: 'localhost:5000'
  },
  writable: true
});

// Helper to get the last created WebSocket client
const getLastWebSocket = (): MockWebSocket => {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
};

describe('WebSocketClient', () => {
  let client: any; // Use any to access private properties for testing
  
  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.reset();
    
    // Reset the singleton before each test
    (WebSocketClient as any).resetInstance();
    client = (WebSocketClient as any).getInstance();
  });
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  test('creates a singleton instance', () => {
    const instance1 = (WebSocketClient as any).getInstance();
    const instance2 = (WebSocketClient as any).getInstance();
    
    expect(instance1).toBe(instance2);
  });
  
  test('connects to WebSocket server', async () => {
    const connectPromise = client.connect();
    
    // Simulate successful connection
    const ws = getLastWebSocket();
    expect(ws.url).toBe('ws://localhost:5000/ws');
    
    // Advance timers to trigger the async connection
    jest.runAllTimers();
    
    await connectPromise;
    expect(client.getStatus()).toBe('connected');
  });
  
  test('handles connection messages with session ID', async () => {
    await client.connect();
    jest.runAllTimers();
    
    const ws = getLastWebSocket();
    ws.simulateMessage({
      type: 'connection',
      sessionId: 'test-session-123'
    });
    
    expect(client.getSessionId()).toBe('test-session-123');
  });
  
  test('registers role and language', async () => {
    await client.connect();
    jest.runAllTimers();
    
    const role: UserRole = 'teacher';
    const languageCode = 'en-US';
    
    client.register(role, languageCode);
    
    // Verify the sent message
    expect(MockWebSocket.sentMessages.length).toBe(1);
    const sentMessage = JSON.parse(MockWebSocket.sentMessages[0]);
    expect(sentMessage).toEqual({
      type: 'register',
      role,
      languageCode
    });
    
    expect(client.getRole()).toBe(role);
    expect(client.getLanguageCode()).toBe(languageCode);
  });
  
  test('sends transcription', async () => {
    await client.connect();
    jest.runAllTimers();
    
    client.register('teacher', 'en-US');
    client.sendTranscription('This is a test transcription');
    
    expect(MockWebSocket.sentMessages.length).toBe(2);
    const sentMessage = JSON.parse(MockWebSocket.sentMessages[1]);
    expect(sentMessage).toEqual({
      type: 'transcription',
      text: 'This is a test transcription'
    });
  });
  
  test('prevents non-teachers from sending transcriptions', async () => {
    await client.connect();
    jest.runAllTimers();
    
    client.register('student', 'fr-FR');
    client.sendTranscription('This should not be sent');
    
    // Only the register message should be sent, not the transcription
    expect(MockWebSocket.sentMessages.length).toBe(1);
    const sentMessage = JSON.parse(MockWebSocket.sentMessages[0]);
    expect(sentMessage.type).toBe('register');
  });
  
  test('notifies listeners on events', async () => {
    const openCallback = jest.fn();
    const messageCallback = jest.fn();
    const statusCallback = jest.fn();
    const translationCallback = jest.fn();
    
    client.addEventListener('open', openCallback);
    client.addEventListener('message', messageCallback);
    client.addEventListener('status', statusCallback);
    client.addEventListener('translation', translationCallback);
    
    await client.connect();
    jest.runAllTimers();
    
    // Open event should be called
    expect(openCallback).toHaveBeenCalled();
    expect(statusCallback).toHaveBeenCalledWith('connected');
    
    // Simulate receiving a translation message
    const translationMsg: WebSocketMessage = {
      type: 'translation',
      text: 'Translated text',
      originalLanguage: 'en-US',
      translatedLanguage: 'fr-FR'
    };
    
    getLastWebSocket().simulateMessage(translationMsg);
    
    // Both message and translation callbacks should be called
    expect(messageCallback).toHaveBeenCalledWith(translationMsg);
    expect(translationCallback).toHaveBeenCalledWith(translationMsg);
  });
  
  test('handles connection close and attempts to reconnect', async () => {
    await client.connect();
    jest.runAllTimers();
    
    // Simulate connection close
    getLastWebSocket().simulateClose(1000, 'Normal closure');
    
    // Status should be updated
    expect(client.getStatus()).toBe('disconnected');
    
    // Override reconnect delay for faster tests
    (client as any).reconnectTimer = setTimeout(() => {
      (client as any).reconnectAttempts++;
      (client as any).connect().catch(console.error);
    }, 100);
    
    // Should attempt to reconnect after delay
    jest.advanceTimersByTime(100);
    
    // A new connection should be attempted
    expect(MockWebSocket.instances.length).toBe(2);
  }, 2000);
  
  test('sends ping messages to keep connection alive', async () => {
    await client.connect();
    jest.runAllTimers();
    
    // Clear initial messages
    MockWebSocket.sentMessages = [];
    
    // Override ping interval for faster tests
    if ((client as any).pingInterval) {
      clearInterval((client as any).pingInterval);
    }
    
    // Set a shorter ping interval
    (client as any).pingInterval = setInterval(() => {
      if ((client as any).ws && (client as any).ws.readyState === WebSocket.OPEN) {
        (client as any).send({
          type: 'ping',
          timestamp: Date.now()
        });
      }
    }, 100);
    
    // Advance time to trigger ping
    jest.advanceTimersByTime(100);
    
    // Should have sent a ping message
    expect(MockWebSocket.sentMessages.length).toBe(1);
    const pingMessage = JSON.parse(MockWebSocket.sentMessages[0]);
    expect(pingMessage.type).toBe('ping');
    expect(pingMessage.timestamp).toBeDefined();
  }, 2000);
  
  test('cleans up resources on disconnect', async () => {
    await client.connect();
    jest.runAllTimers();
    
    // Spy on clearInterval and clearTimeout
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    client.disconnect();
    
    // Should clear intervals and timeouts
    expect(clearIntervalSpy).toHaveBeenCalled();
    
    // WebSocket should be closed
    const ws = getLastWebSocket();
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
  
  test('handles secure connection with wss protocol', async () => {
    // Modify window.location to use https
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'https:',
        host: 'secure-example.com'
      },
      writable: true
    });
    
    await client.connect();
    jest.runAllTimers();
    
    const ws = getLastWebSocket();
    expect(ws.url).toBe('wss://secure-example.com/ws');
    expect(client.getStatus()).toBe('connected');
  });
  
  test('handles connection errors', async () => {
    const connectPromise = client.connect();
    const errorCallback = jest.fn();
    client.addEventListener('error', errorCallback);
    
    // Simulate connection error
    const mockError = new Error('Connection failed');
    getLastWebSocket().simulateError(mockError);
    
    // Should reject the connection promise
    await expect(connectPromise).rejects.toEqual(mockError);
    
    // Status should be error
    expect(client.getStatus()).toBe('error');
    
    // Error callback should be called
    expect(errorCallback).toHaveBeenCalledWith(mockError);
  });
});