/**
 * Unit tests for ConnectionManager
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionManager } from '../../../server/services/ConnectionManager';
import { WebSocket } from 'ws';

class MockWebSocket extends WebSocket {
  constructor() {
    super('ws://localhost');
  }
}

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockWSS: any;

  beforeEach(() => {
    mockWSS = { clients: new Set() };
    connectionManager = new ConnectionManager(mockWSS);
  });

  it('should add a connection', () => {
    const mockWS = new MockWebSocket();
    connectionManager.addConnection(mockWS, { socket: { remoteAddress: '127.0.0.1' } } as any);
    expect(connectionManager.getConnections().has(mockWS)).toBe(true);
  });

  it('should remove a connection', () => {
    const mockWS = new MockWebSocket();
    connectionManager.addConnection(mockWS, { socket: { remoteAddress: '127.0.0.1' } } as any);
    connectionManager.removeConnection(mockWS);
    expect(connectionManager.getConnections().has(mockWS)).toBe(false);
  });
});