/**
 * Simplified WebSocketClient tests that avoid timeouts
 */
import { WebSocketClient } from '../../../client/src/lib/websocket';

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

describe('WebSocketClient Basic Tests', () => {
  beforeEach(() => {
    WebSocketClient.resetInstance();
  });
  
  test('creates a singleton instance', () => {
    const instance1 = WebSocketClient.getInstance();
    const instance2 = WebSocketClient.getInstance();
    expect(instance1).toBe(instance2);
  });
  
  test('builds the correct WebSocket URL', () => {
    // Mock WebSocket constructor to capture URL
    let capturedUrl = '';
    (global as any).WebSocket = jest.fn((url: string) => {
      capturedUrl = url;
      return {
        readyState: WebSocket.OPEN,
        close: jest.fn()
      };
    });
    
    const wsClient = WebSocketClient.getInstance();
    wsClient.connect();
    
    expect(capturedUrl).toBe('ws://localhost:5000/ws');
    
    // Test HTTPS -> WSS
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', host: 'example.com' },
      writable: true
    });
    
    WebSocketClient.resetInstance();
    const secureClient = WebSocketClient.getInstance();
    secureClient.connect();
    
    expect(capturedUrl).toBe('wss://example.com/ws');
  });
});