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
      isAlive: false
    } as any;

    context = {
      ws: mockWs,
      connectionManager: {} as any,
      storage: {} as any,
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
});
