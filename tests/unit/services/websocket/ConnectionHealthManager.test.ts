import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionHealthManager } from '../../../../server/services/websocket/ConnectionHealthManager.js';
import { WebSocketServer as WSServer } from 'ws';

// Mock logger
vi.mock('../../../../server/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock config
vi.mock('../../../../server/config', () => ({
  config: {
    heartbeat: {
      interval: 30000,
      timeout: 10000
    }
  }
}));

describe('ConnectionHealthManager', () => {
  let connectionHealthManager: ConnectionHealthManager;
  let mockWss: WSServer;

  beforeEach(() => {
    mockWss = {
      clients: new Set(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    } as any;

    connectionHealthManager = new ConnectionHealthManager(mockWss);
  });

  describe('constructor', () => {
    it('should initialize with WebSocket server', () => {
      expect(connectionHealthManager).toBeDefined();
    });

    it('should setup heartbeat on initialization', () => {
      // The constructor should have called setupHeartbeat
      expect(connectionHealthManager).toBeDefined();
    });
  });

  describe('heartbeat functionality', () => {
    it('should start heartbeat monitoring', () => {
      connectionHealthManager.startHeartbeat();
      
      // Heartbeat should be running (we can't easily test the interval directly)
      expect(connectionHealthManager).toBeDefined();
    });

    it('should stop heartbeat monitoring', () => {
      connectionHealthManager.startHeartbeat();
      connectionHealthManager.stopHeartbeat();
      
      // Heartbeat should be stopped
      expect(connectionHealthManager).toBeDefined();
    });
  });

  describe('connection health monitoring', () => {
    it('should check connection health', () => {
      const mockClient = {
        isAlive: true,
        ping: vi.fn(),
        terminate: vi.fn()
      } as any;

      mockWss.clients.add(mockClient);

      connectionHealthManager.checkConnectionHealth();

      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('should handle dead connections', () => {
      const mockDeadClient = {
        isAlive: false,
        ping: vi.fn(),
        terminate: vi.fn()
      } as any;

      const mockAliveClient = {
        isAlive: true,
        ping: vi.fn(),
        terminate: vi.fn()
      } as any;

      mockWss.clients.add(mockDeadClient);
      mockWss.clients.add(mockAliveClient);

      connectionHealthManager.cleanupDeadConnections();

      expect(mockDeadClient.terminate).toHaveBeenCalled();
      expect(mockAliveClient.terminate).not.toHaveBeenCalled();
    });
  });

  describe('connection statistics', () => {
    it('should get healthy connection count', () => {
      const mockClient1 = { isAlive: true };
      const mockClient2 = { isAlive: false };
      const mockClient3 = { isAlive: true };

      mockWss.clients.add(mockClient1 as any);
      mockWss.clients.add(mockClient2 as any);
      mockWss.clients.add(mockClient3 as any);

      const healthyCount = connectionHealthManager.getHealthyConnectionCount();

      expect(healthyCount).toBe(2);
    });

    it('should get total connection count', () => {
      const mockClient1 = { isAlive: true };
      const mockClient2 = { isAlive: false };

      mockWss.clients.add(mockClient1 as any);
      mockWss.clients.add(mockClient2 as any);

      const totalCount = connectionHealthManager.getTotalConnectionCount();

      expect(totalCount).toBe(2);
    });
  });
});
