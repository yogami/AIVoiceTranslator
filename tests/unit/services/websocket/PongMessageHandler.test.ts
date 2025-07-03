import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PongMessageHandler } from '../../../../server/services/websocket/PongMessageHandler';
import { MessageHandlerContext } from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import logger from '../../../../server/logger';

// Mock logger
vi.mock('../../../../server/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  }
}));

describe('PongMessageHandler', () => {
  let handler: PongMessageHandler;
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

    handler = new PongMessageHandler();
  });

  describe('getMessageType', () => {
    it('should handle pong message type', () => {
      expect(handler.getMessageType()).toBe('pong');
    });
  });

  describe('handle', () => {
    it('should mark connection as alive on pong', async () => {
      const pongMessage = {
        type: 'pong' as const
      };

      expect(mockWs.isAlive).toBe(false);

      await handler.handle(pongMessage, context);

      expect(mockWs.isAlive).toBe(true);
    });

    it('should handle pong message without additional processing', async () => {
      const pongMessage = {
        type: 'pong' as const
      };

      await handler.handle(pongMessage, context);

      // Should not send any response
      expect(mockWs.send).not.toHaveBeenCalled();
      
      // Should not log anything (pong is a simple acknowledgment)
      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should handle pong when connection is already alive', async () => {
      mockWs.isAlive = true;

      const pongMessage = {
        type: 'pong' as const
      };

      await handler.handle(pongMessage, context);

      // Should still be alive
      expect(mockWs.isAlive).toBe(true);
    });

    it('should handle multiple pong messages', async () => {
      const pongMessage = {
        type: 'pong' as const
      };

      // Send multiple pong messages
      await handler.handle(pongMessage, context);
      await handler.handle(pongMessage, context);
      await handler.handle(pongMessage, context);

      // Connection should remain alive
      expect(mockWs.isAlive).toBe(true);
      
      // No responses should be sent
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should not throw errors during processing', async () => {
      const pongMessage = {
        type: 'pong' as const
      };

      // Should complete without errors
      await expect(handler.handle(pongMessage, context)).resolves.toBeUndefined();
    });

    it('should handle pong message with additional properties', async () => {
      const pongMessage = {
        type: 'pong' as const,
        timestamp: Date.now(),
        customProperty: 'value'
      } as any;

      await handler.handle(pongMessage, context);

      expect(mockWs.isAlive).toBe(true);
    });
  });
});
