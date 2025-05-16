/**
 * WebSocket Module Basic Tests (Vitest Version)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from 'http';

// Mock the 'ws' module - BEFORE imports
vi.mock('ws', () => {
  const MOCK_WS_STATES = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
  
  return {
    WebSocketServer: vi.fn(() => ({
      on: vi.fn(),
      clients: new Set([
        {
          send: vi.fn(),
          readyState: MOCK_WS_STATES.OPEN
        }
      ])
    })),
    CONNECTING: MOCK_WS_STATES.CONNECTING,
    OPEN: MOCK_WS_STATES.OPEN,
    CLOSING: MOCK_WS_STATES.CLOSING,
    CLOSED: MOCK_WS_STATES.CLOSED
  };
});

// Import after mocks
import { createWebSocketServer, broadcastMessage } from '../../server/websocket';

describe('WebSocket Basic Tests', () => {
  let httpServer;
  let wsService;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock server
    httpServer = {
      on: vi.fn()
    };
    
    // Create service
    wsService = createWebSocketServer(httpServer);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should create a WebSocket service', () => {
    // Check if service was created
    expect(wsService).toBeDefined();
  });
  
  it('should broadcast to clients', () => {
    // Get the actual server
    const server = wsService.getServer();
    
    // Broadcast a message
    broadcastMessage(server, { type: 'test' });
    
    // Verify client received message
    const client = Array.from(server.clients)[0];
    expect(client.send).toHaveBeenCalled();
  });
});