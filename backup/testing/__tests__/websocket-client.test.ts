/**
 * WebSocketClient tests
 * 
 * Note: These tests mock the WebSocket functionality since
 * we can't establish real connections in a test environment
 */

// Mock the WebSocket class
class MockWebSocket {
  readyState = 1; // WebSocket.OPEN
  onopen: () => void = () => {};
  onmessage: (event: any) => void = () => {};
  onclose: () => void = () => {};
  onerror: (error: any) => void = () => {};
  
  constructor(public url: string) {
    // Simulate connection after a small delay
    setTimeout(() => {
      this.onopen();
    }, 10);
  }
  
  send(data: string) {
    // We can use this to verify what was sent
    return data;
  }
  
  close() {
    this.onclose();
  }
}

// Define a WebSocket global as if this were a browser environment
global.WebSocket = MockWebSocket as any;

// Optional: Mock other browser globals that the WebSocket client might use
global.window = {
  location: {
    protocol: 'http:',
    host: 'localhost:5000'
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
} as any;

// Import after the mock setup
import { WebSocketClient, WebSocketStatus, UserRole } from '../client/src/lib/websocket';

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  
  beforeEach(() => {
    client = new WebSocketClient();
    
    // Spy on console methods to silence them in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('connect() establishes a WebSocket connection', () => {
    // Create a callback we can spy on
    const statusListener = jest.fn();
    client.addEventListener('status', statusListener);
    
    // Connect and verify
    client.connect();
    
    // Since our mock sets up the connection after a short delay,
    // we need to wait for that to happen
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(client.getStatus()).toBe('connected');
        expect(statusListener).toHaveBeenCalledWith('connected');
        resolve();
      }, 20);
    });
  });
  
  test('send() sends JSON messages over the WebSocket', () => {
    // Setup
    const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');
    client.connect();
    
    // Wait for connection
    return new Promise<void>(resolve => {
      setTimeout(() => {
        // Send a test message
        const message = { type: 'test', payload: { data: 'test-data' } };
        client.send(message);
        
        // Verify the message was sent as JSON
        expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
        resolve();
      }, 20);
    });
  });
  
  test('register() sends registration message with role and language', () => {
    // Setup
    const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');
    client.connect();
    
    // Wait for connection
    return new Promise<void>(resolve => {
      setTimeout(() => {
        // Register as a teacher
        const role: UserRole = 'teacher';
        const languageCode = 'en-US';
        client.register(role, languageCode);
        
        // Verify registration message
        expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('register'));
        expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining(role));
        expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining(languageCode));
        resolve();
      }, 20);
    });
  });
  
  test('addEventListener and removeEventListener manage event listeners', () => {
    // Setup
    const listener = jest.fn();
    
    // Add listener
    client.addEventListener('test-event', listener);
    
    // Manually trigger the event using private method via any cast
    (client as any).notifyListeners('test-event', 'test-data');
    expect(listener).toHaveBeenCalledWith('test-data');
    
    // Clear calls count
    listener.mockClear();
    
    // Remove listener
    client.removeEventListener('test-event', listener);
    
    // Trigger again, should not be called
    (client as any).notifyListeners('test-event', 'more-data');
    expect(listener).not.toHaveBeenCalled();
  });
  
  test('disconnect() closes the connection', () => {
    // Setup
    const closeSpy = jest.spyOn(MockWebSocket.prototype, 'close');
    client.connect();
    
    // Wait for connection
    return new Promise<void>(resolve => {
      setTimeout(() => {
        // Disconnect
        client.disconnect();
        
        // Verify
        expect(closeSpy).toHaveBeenCalled();
        expect(client.getStatus()).toBe('disconnected');
        resolve();
      }, 20);
    });
  });
});