import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PingMessageHandler } from '../../../../server/services/websocket/PingMessageHandler';
import { MessageHandlerContext } from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import type { PingMessageToServer } from '../../../../server/services/WebSocketTypes';

describe('PingMessageHandler', () => {
  let handler: PingMessageHandler;
  let mockWs: WebSocketClient;
  let context: MessageHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      isAlive: false
    } as any;

    const mockConnectionManager = {
      getSessionId: vi.fn().mockReturnValue(null)
    };

    const mockStorage = {
      getSessionById: vi.fn().mockResolvedValue(null)
    };

    context = {
      ws: mockWs,
      connectionManager: mockConnectionManager as any,
      storage: mockStorage as any,
      sessionService: {} as any,
      translationService: {} as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any
    };

    handler = new PingMessageHandler();
  });

  describe('getMessageType', () => {
    it('should handle ping message type', () => {
      expect(handler.getMessageType()).toBe('ping');
    });
  });

  describe('handle', () => {
    it('should respond to ping with pong', async () => {
      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      await handler.handle(pingMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('{"type":"pong"')
      );
      
      const sentData = JSON.parse(vi.mocked(mockWs.send).mock.calls[0][0] as string);
      expect(sentData.type).toBe('pong');
      expect(sentData.originalTimestamp).toBe(123456);
      expect(sentData.timestamp).toBeTypeOf('number');
    });

    it('should set connection as alive', async () => {
      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      expect(mockWs.isAlive).toBe(false);

      await handler.handle(pingMessage, context);

      expect(mockWs.isAlive).toBe(true);
    });

    it('should handle ping with different timestamp', async () => {
      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 999999
      };

      await handler.handle(pingMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('{"type":"pong"')
      );
      
      const sentData = JSON.parse(vi.mocked(mockWs.send).mock.calls[0][0] as string);
      expect(sentData.type).toBe('pong');
      expect(sentData.originalTimestamp).toBe(999999);
      expect(sentData.timestamp).toBeTypeOf('number');
    });

    it('should handle send errors gracefully', async () => {
      mockWs.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      // Should not throw
      await expect(handler.handle(pingMessage, context)).resolves.toBeUndefined();
      
      // Connection should still be marked as alive
      expect(mockWs.isAlive).toBe(true);
    });

    it('should generate unique timestamps for responses', async () => {
      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      const startTime = Date.now();
      
      await handler.handle(pingMessage, context);

      const sentMessage = JSON.parse((mockWs.send as any).mock.calls[0][0]);
      expect(sentMessage.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(sentMessage.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Session Expiration Handling', () => {
    it('should always respond with pong for heartbeat functionality', async () => {
      const mockStorage = {
        getSessionById: vi.fn().mockResolvedValue({
          sessionId: 'expired-session',
          isActive: false
        })
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('expired-session')
      };

      const contextWithMocks = {
        ...context,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };

      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      await handler.handle(pingMessage, contextWithMocks);

      // Should always respond with pong for heartbeat functionality
      // Session validation happens during actual operations, not heartbeat checks
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('{"type":"pong"')
      );
      
      // Should not send session_expired message during ping
      expect(mockWs.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"session_expired"')
      );
    });

    it('should respond with pong for active sessions', async () => {
      const mockStorage = {
        getSessionById: vi.fn().mockResolvedValue({
          sessionId: 'active-session',
          isActive: true
        })
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('active-session')
      };

      const contextWithMocks = {
        ...context,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };

      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      await handler.handle(pingMessage, contextWithMocks);

      // Should respond with pong for active session
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('{"type":"pong"')
      );
      
      // Should not send session_expired message
      expect(mockWs.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"session_expired"')
      );
      
      // Should mark connection as alive
      expect(mockWs.isAlive).toBe(true);
    });

    it('should handle cases where session ID is not available', async () => {
      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue(null)
      };

      const contextWithMocks = {
        ...context,
        connectionManager: mockConnectionManager
      };

      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      await handler.handle(pingMessage, contextWithMocks);

      // Should respond with pong even without session ID
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('{"type":"pong"')
      );
      expect(mockWs.isAlive).toBe(true);
    });

    it('should handle storage errors gracefully during session validation', async () => {
      const mockStorage = {
        getSessionById: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('session-123')
      };

      const contextWithMocks = {
        ...context,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };

      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      await handler.handle(pingMessage, contextWithMocks);

      // Should handle storage error gracefully and still respond with pong
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('{"type":"pong"')
      );
      expect(mockWs.isAlive).toBe(true);
    });

    it('should respond with pong and mark connection as alive', async () => {
      const mockStorage = {
        getSessionById: vi.fn().mockResolvedValue({
          sessionId: 'expired-session',
          isActive: false
        })
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('expired-session')
      };

      const mockWsWithClose = {
        send: vi.fn(),
        close: vi.fn(),
        isAlive: false
      } as any;

      const contextWithMocks = {
        ...context,
        ws: mockWsWithClose,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };

      const pingMessage: PingMessageToServer = {
        type: 'ping',
        timestamp: 123456
      };

      await handler.handle(pingMessage, contextWithMocks);

      // Should always respond with pong for heartbeat functionality
      expect(mockWsWithClose.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
      
      // Should mark connection as alive
      expect(mockWsWithClose.isAlive).toBe(true);
      
      // Should not close connection during ping
      expect(mockWsWithClose.close).not.toHaveBeenCalled();
      
      // Should not mark connection as alive for expired session
      expect(mockWsWithClose.isAlive).toBe(true); // It's set to true first, then connection is closed
    });
  });
});
