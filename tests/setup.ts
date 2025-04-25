// This file contains setup code for Jest tests

import '@testing-library/jest-dom';

// Mock environment variables
process.env.OPENAI_API_KEY = 'mock-openai-api-key';

// Mock WebSocket for node environment
global.WebSocket = class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: number = 0;
  
  constructor(url: string) {
    this.url = url;
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data: string): void {
    // Mock implementation
  }
  
  close(): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }
};

// Global test timeout
jest.setTimeout(30000);