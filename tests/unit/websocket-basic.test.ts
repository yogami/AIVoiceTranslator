/**
 * Basic WebSocket Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketService, WebSocketState, createWebSocketServer } from '../../server/websocket';
import { Server } from 'http';
import { WebSocket } from 'ws';

// Mock WebSocket
vi.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;
  
  class MockWebSocket extends EventEmitter {
    binaryType = 'arraybuffer';
    bufferedAmount = 0;
    extensions = '';
    protocol = '';
    readyState = WebSocketState.OPEN;
    url = 'ws://localhost:8080/ws';
    
    // Custom properties for testing
    isAlive = true;
    sessionId = undefined;
    role = undefined;
    languageCode = undefined;
    
    // Mock methods
    send = vi.fn();
    ping = vi.fn();
    terminate = vi.fn();
    close = vi.fn();
  }
  
  class MockWSServer extends EventEmitter {
    clients = new Set();
    
    constructor() {
      super();
      // Add default client
      this.clients.add(new MockWebSocket());
    }
    
    on = vi.fn((event, callback) => {
      super.on(event, callback);
      return this;
    });
  }
  
  return {
    WebSocket: MockWebSocket,
    WebSocketServer: MockWSServer
  };
});

describe('WebSocketService', () => {
  let httpServer: Server;
  let wsService: WebSocketService;
  
  beforeEach(() => {
    httpServer = new Server();
    wsService = new WebSocketService(httpServer);
  });
  
  it('should create a WebSocketService instance', () => {
    expect(wsService).toBeInstanceOf(WebSocketService);
  });
  
  it('should get the server instance', () => {
    const wss = wsService.getServer();
    expect(wss).toBeDefined();
  });
});