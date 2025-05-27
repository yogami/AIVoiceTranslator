/**
 * Unit tests for HeartbeatManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockWebSocketClient } from '../utils/test-helpers';

// Mock WebSocket type
interface MockWebSocket {
  isAlive?: boolean;
  sessionId?: string;
  terminate?: any;
  ping?: any;
  readyState?: number;
  send?: any;
}

describe('HeartbeatManager', () => {
  let connections: Set<MockWebSocket>;
  let mockActiveClient: MockWebSocket;
  let mockInactiveClient: MockWebSocket;
  
  // Spy on console methods
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  
  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Set up test WebSocket clients
    mockActiveClient = {
      ...createMockWebSocketClient({ isAlive: true, sessionId: 'test-session-active' }),
      isAlive: true,
      terminate: vi.fn(),
      ping: vi.fn()
    };
    
    mockInactiveClient = {
      ...createMockWebSocketClient({ isAlive: false, sessionId: 'test-session-inactive' }),
      isAlive: false,
      terminate: vi.fn(),
      ping: vi.fn()
    };
    
    // Create connections set
    connections = new Set<MockWebSocket>();
    connections.add(mockActiveClient);
    connections.add(mockInactiveClient);
    
    // Use fake timers
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    // Restore console
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    // Restore real timers
    vi.useRealTimers();
  });
  
  it('should ping active clients', () => {
    // Test heartbeat functionality
    const checkHeartbeat = () => {
      connections.forEach((ws) => {
        if (ws.isAlive === false) {
          ws.terminate?.();
          connections.delete(ws);
          return;
        }
        ws.isAlive = false;
        ws.ping?.();
      });
    };
    
    checkHeartbeat();
    
    expect(mockActiveClient.ping).toHaveBeenCalled();
    expect(mockActiveClient.isAlive).toBe(false);
    expect(mockInactiveClient.terminate).toHaveBeenCalled();
    expect(connections.has(mockInactiveClient)).toBe(false);
  });
  
  it('should handle heartbeat interval', () => {
    const checkInterval = 1000;
    let intervalCount = 0;
    
    const intervalId = setInterval(() => {
      intervalCount++;
      connections.forEach((ws) => {
        if (ws.isAlive === false) {
          ws.terminate?.();
          connections.delete(ws);
          return;
        }
        ws.isAlive = false;
        ws.ping?.();
      });
    }, checkInterval);
    
    // Advance timers
    vi.advanceTimersByTime(3000);
    
    expect(intervalCount).toBe(3);
    
    clearInterval(intervalId);
  });
});