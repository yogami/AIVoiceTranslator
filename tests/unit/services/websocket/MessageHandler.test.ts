import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  MessageHandlerRegistry, 
  MessageDispatcher,
  MessageHandlerContext,
  IMessageHandler 
} from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import logger from '../../../../server/logger';

// Mock logger
vi.mock('../../../../server/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('MessageHandlerRegistry', () => {
  let registry: MessageHandlerRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MessageHandlerRegistry();
  });

  describe('register', () => {
    it('should register a message handler', () => {
      const handler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn()
      };

      registry.register(handler);

      expect(registry.getHandler('test')).toBe(handler);
    });

    it('should handle multiple handlers', () => {
      const handler1: IMessageHandler = {
        getMessageType: () => 'test1',
        handle: vi.fn()
      };
      const handler2: IMessageHandler = {
        getMessageType: () => 'test2',
        handle: vi.fn()
      };

      registry.register(handler1);
      registry.register(handler2);

      expect(registry.getHandler('test1')).toBe(handler1);
      expect(registry.getHandler('test2')).toBe(handler2);
      expect(registry.getRegisteredTypes()).toContain('test1');
      expect(registry.getRegisteredTypes()).toContain('test2');
    });
  });

  describe('getHandler', () => {
    it('should return undefined for non-existent handler', () => {
      expect(registry.getHandler('nonexistent')).toBeUndefined();
    });
  });

  describe('hasHandler', () => {
    it('should return false for non-existent handler', () => {
      expect(registry.hasHandler('nonexistent')).toBe(false);
    });

    it('should return true for registered handler', () => {
      const handler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn()
      };

      registry.register(handler);

      expect(registry.hasHandler('test')).toBe(true);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return empty array when no handlers registered', () => {
      expect(registry.getRegisteredTypes()).toEqual([]);
    });

    it('should return array of registered message types', () => {
      const handler1: IMessageHandler = {
        getMessageType: () => 'test1',
        handle: vi.fn()
      };
      const handler2: IMessageHandler = {
        getMessageType: () => 'test2',
        handle: vi.fn()
      };

      registry.register(handler1);
      registry.register(handler2);

      const types = registry.getRegisteredTypes();
      expect(types).toContain('test1');
      expect(types).toContain('test2');
      expect(types).toHaveLength(2);
    });
  });
});

describe('MessageDispatcher', () => {
  let dispatcher: MessageDispatcher;
  let registry: MessageHandlerRegistry;
  let mockContext: MessageHandlerContext;
  let mockWs: WebSocketClient;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MessageHandlerRegistry();
    mockWs = { send: vi.fn() } as any;
    mockContext = {
      ws: mockWs,
      connectionManager: {},
      storage: {},
      sessionService: {},
      translationService: {},
      sessionLifecycleService: {},
      webSocketServer: {}
    };
    dispatcher = new MessageDispatcher(registry, mockContext);
  });

  describe('dispatch', () => {
    it('should dispatch message to appropriate handler', async () => {
      const mockHandler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn().mockResolvedValue(undefined)
      };

      registry.register(mockHandler);

      const message = JSON.stringify({ type: 'test', data: 'test data' });
      await dispatcher.dispatch(mockWs, message);

      expect(mockHandler.handle).toHaveBeenCalledWith(
        { type: 'test', data: 'test data' },
        expect.objectContaining({
          ws: mockWs,
          connectionManager: mockContext.connectionManager,
          storage: mockContext.storage
        })
      );
    });

    it('should handle unknown message types gracefully', async () => {
      const message = JSON.stringify({ type: 'unknown', data: 'test data' });
      
      await expect(dispatcher.dispatch(mockWs, message)).resolves.not.toThrow();
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Unknown message type:',
        { type: 'unknown' }
      );
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidMessage = 'invalid json';
      
      await expect(dispatcher.dispatch(mockWs, invalidMessage)).resolves.not.toThrow();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error handling message:',
        expect.objectContaining({
          data: invalidMessage,
          error: expect.any(Error)
        })
      );
    });
  });
});
