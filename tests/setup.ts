// This file contains setup code for Jest tests

import '@testing-library/jest-dom';

// Mock environment variables
process.env.OPENAI_API_KEY = 'mock-openai-api-key';

// Mock WebSocket for node environment
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: number = 0;
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  
  constructor(url: string) {
    this.url = url;
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data: string): void {
    // Mock implementation
  }
  
  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}

// Add the WebSocket to the global namespace
(global as any).WebSocket = MockWebSocket;

// Global test timeout
jest.setTimeout(30000);