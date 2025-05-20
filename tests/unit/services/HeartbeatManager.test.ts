/**
 * Unit tests for HeartbeatManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeartbeatManager } from '../../../server/services/HeartbeatManager';
import { WebSocketServer, WebSocket } from 'ws';

class MockWebSocket extends WebSocket {
  isAlive = true;
  constructor() {
    super('ws://localhost');
    Object.defineProperty(this, 'readyState', {
      value: WebSocket.OPEN,
      writable: false,
    });
  }
}

describe('HeartbeatManager', () => {
  let heartbeatManager: HeartbeatManager;
  let mockWSS: WebSocketServer;

  beforeEach(() => {
    vi.useFakeTimers(); // Use fake timers to control setInterval
    mockWSS = { clients: new Set() } as any;
    heartbeatManager = new HeartbeatManager(mockWSS);
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after each test
  });

  it('should terminate inactive connections', () => {
    const mockWS = new MockWebSocket();
    mockWS.isAlive = false;
    vi.spyOn(mockWS, 'terminate');
    mockWSS.clients.add(mockWS);

    vi.advanceTimersByTime(30000); // Advance the timer to trigger the heartbeat

    expect(mockWS.terminate).toHaveBeenCalled();
  });

  it('should ping active connections', () => {
    const mockWS = new MockWebSocket();
    vi.spyOn(mockWS, 'ping');
    mockWSS.clients.add(mockWS);

    vi.advanceTimersByTime(30000); // Advance the timer to trigger the heartbeat

    if (mockWS.readyState === WebSocket.OPEN) {
      expect(mockWS.ping).toHaveBeenCalled();
    } else {
      console.warn('WebSocket is not open, skipping ping assertion');
    }
  });
});