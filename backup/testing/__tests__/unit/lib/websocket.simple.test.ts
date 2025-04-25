/**
 * Simplified WebSocketClient tests that avoid timeouts
 */
import { 
  WebSocketClient, 
  WebSocketService, 
  WebSocketFactory 
} from '../../../client/src/lib/websocket';

// Mock WebSocket
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState = 1; // WebSocket.OPEN
  
  constructor(url: string) {
    this.url = url;
  }
  
  send(data: string) {
    // Mock implementation
  }
  
  close() {
    // Mock implementation
  }
}

// Define WebSocket constants
(global as any).WebSocket = MockWebSocket;
(global as any).WebSocket.CONNECTING = 0;
(global as any).WebSocket.OPEN = 1;
(global as any).WebSocket.CLOSING = 2;
(global as any).WebSocket.CLOSED = 3;

// Mock location
Object.defineProperty(window, 'location', {
  value: { protocol: 'http:', host: 'localhost:5000' },
  writable: true
});

// Create a mock WebSocketFactory for testing
class TestWebSocketFactory implements WebSocketFactory {
  capturedUrl: string = '';
  
  createWebSocket(url: string): WebSocket {
    this.capturedUrl = url;
    return new MockWebSocket(url);
  }
}

describe('WebSocketClient Basic Tests', () => {
  beforeEach(() => {
    // Reset the WebSocketService before each test
    WebSocketService.resetClient();
  });
  
  test('WebSocketService creates a shared client instance', () => {
    const instance1 = WebSocketService.createClient();
    const instance2 = WebSocketService.createClient();
    expect(instance1).toBe(instance2);
  });
  
  test('builds the correct WebSocket URL', () => {
    // Create a factory that can capture the URL
    const factory = new TestWebSocketFactory();
    
    // Create client with our test factory 
    const wsClient = new WebSocketClient(factory);
    wsClient.connect();
    
    // Verify URL was correctly formed
    expect(factory.capturedUrl).toBe('ws://localhost:5000/ws');
    
    // Test HTTPS -> WSS
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', host: 'example.com' },
      writable: true
    });
    
    // Create a new factory and client for the HTTPS test
    const secureFactory = new TestWebSocketFactory();
    const secureClient = new WebSocketClient(secureFactory);
    secureClient.connect();
    
    // Verify secure URL was correctly formed
    expect(secureFactory.capturedUrl).toBe('wss://example.com/ws');
  });
  
  test('custom path is included in WebSocket URL', () => {
    const factory = new TestWebSocketFactory();
    const customPathClient = new WebSocketClient(factory, '/custom-ws-path');
    customPathClient.connect();
    
    expect(factory.capturedUrl).toBe('ws://localhost:5000/custom-ws-path');
  });
});