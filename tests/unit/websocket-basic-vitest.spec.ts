/**
 * WebSocket Basic Tests (Vitest Version)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from 'http';

// Mock WS module with constants defined inline
vi.mock('ws', () => {
  return {
    WebSocketServer: vi.fn(() => ({
      on: vi.fn(),
      clients: new Set(),
      emit: vi.fn()
    })),
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
});

// Import the module under test after mocking
import { WebSocketService, createWebSocketServer } from '../../server/websocket';

describe('WebSocket Basic Tests', () => {
  let httpServer;
  let wsService;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock HTTP server
    httpServer = {
      on: vi.fn()
    };
    
    // Create WebSocket service
    wsService = createWebSocketServer(httpServer);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should create a WebSocketService instance', () => {
    expect(wsService).toBeInstanceOf(WebSocketService);
  });
  
  it('should provide access to the WebSocket server', () => {
    const server = wsService.getServer();
    expect(server).toBeDefined();
  });
});