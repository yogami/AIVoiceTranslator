/**
 * Unit tests for ConnectionManager
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../../../server/services/managers/ConnectionManager';

// Mock WebSocket to avoid real connections
vi.mock('ws', () => {
  return {
    WebSocket: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      readyState: 1
    }))
  };
});

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockWSS: any;

  beforeEach(() => {
    mockWSS = { clients: new Set() };
    connectionManager = new ConnectionManager(mockWSS);
  });

  it('should add a connection', () => {
    const mockWS = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn()
    };
    connectionManager.addConnection(mockWS as any, { socket: { remoteAddress: '127.0.0.1' } } as any);
    expect(connectionManager.getConnections().has(mockWS as any)).toBe(true);
  });

  it('should remove a connection', () => {
    const mockWS = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn()
    };
    connectionManager.addConnection(mockWS as any, { socket: { remoteAddress: '127.0.0.1' } } as any);
    connectionManager.removeConnection(mockWS as any);
    expect(connectionManager.getConnections().has(mockWS as any)).toBe(false);
  });
});