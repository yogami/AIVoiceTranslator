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
      connectionManager: {
        getSessionId: vi.fn().mockReturnValue(null)
      },
      storage: {
        getSessionById: vi.fn().mockResolvedValue(null)
      },
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

  describe('Session Expiration Handling', () => {
    it('should check session validity before dispatching messages', async () => {
      const mockHandler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn().mockResolvedValue(undefined)
      };

      // Mock storage to return inactive session
      const mockStorage = {
        getSessionById: vi.fn().mockResolvedValue({
          sessionId: 'expired-session',
          isActive: false
        })
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('expired-session')
      };

      registry.register(mockHandler);
      
      const contextWithMocks = {
        ...mockContext,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };
      
      dispatcher = new MessageDispatcher(registry, contextWithMocks);

      const message = JSON.stringify({ type: 'test', data: 'test data' });
      await dispatcher.dispatch(mockWs, message);

      // Handler should not be called for expired session
      expect(mockHandler.handle).not.toHaveBeenCalled();
      
      // Should send session_expired message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"session_expired"')
      );
    });

    it('should allow messages for active sessions', async () => {
      const mockHandler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn().mockResolvedValue(undefined)
      };

      // Mock storage to return active session
      const mockStorage = {
        getSessionById: vi.fn().mockResolvedValue({
          sessionId: 'active-session',
          isActive: true
        })
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('active-session')
      };

      registry.register(mockHandler);
      
      const contextWithMocks = {
        ...mockContext,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };
      
      dispatcher = new MessageDispatcher(registry, contextWithMocks);

      const message = JSON.stringify({ type: 'test', data: 'test data' });
      await dispatcher.dispatch(mockWs, message);

      // Handler should be called for active session
      expect(mockHandler.handle).toHaveBeenCalledWith(
        { type: 'test', data: 'test data' },
        expect.objectContaining({
          ws: mockWs,
          storage: mockStorage,
          connectionManager: mockConnectionManager
        })
      );
      
      // Should not send session_expired message
      expect(mockWs.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"session_expired"')
      );
    });

    it('should handle cases where session ID is not available', async () => {
      const mockHandler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn().mockResolvedValue(undefined)
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue(null)
      };

      registry.register(mockHandler);
      
      const contextWithMocks = {
        ...mockContext,
        connectionManager: mockConnectionManager
      };
      
      dispatcher = new MessageDispatcher(registry, contextWithMocks);

      const message = JSON.stringify({ type: 'test', data: 'test data' });
      await dispatcher.dispatch(mockWs, message);

      // Handler should be called even without session ID (for initial registration)
      expect(mockHandler.handle).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully during session validation', async () => {
      const mockHandler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn().mockResolvedValue(undefined)
      };

      // Mock storage to throw error
      const mockStorage = {
        getSessionById: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('session-123')
      };

      registry.register(mockHandler);
      
      const contextWithMocks = {
        ...mockContext,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };
      
      dispatcher = new MessageDispatcher(registry, contextWithMocks);

      const message = JSON.stringify({ type: 'test', data: 'test data' });
      await dispatcher.dispatch(mockWs, message);

      // Should handle storage error gracefully and still process message
      expect(mockHandler.handle).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error validating session'),
        expect.any(Object)
      );
    });

    it('should close connection after sending session_expired message', async () => {
      const mockHandler: IMessageHandler = {
        getMessageType: () => 'test',
        handle: vi.fn().mockResolvedValue(undefined)
      };

      // Mock storage to return inactive session
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
        close: vi.fn()
      } as any;

      registry.register(mockHandler);
      
      const contextWithMocks = {
        ...mockContext,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };
      
      dispatcher = new MessageDispatcher(registry, contextWithMocks);

      const message = JSON.stringify({ type: 'test', data: 'test data' });
      await dispatcher.dispatch(mockWsWithClose, message);

      // Should send session_expired and close connection
      expect(mockWsWithClose.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"session_expired"')
      );
      
      // Wait for timeout to execute
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(mockWsWithClose.close).toHaveBeenCalled();
    });

    it('should skip session validation for exempt message types', async () => {
      const mockHandler: IMessageHandler = {
        getMessageType: () => 'register',
        handle: vi.fn().mockResolvedValue(undefined)
      };

      // Mock storage to return inactive session
      const mockStorage = {
        getSessionById: vi.fn().mockResolvedValue({
          sessionId: 'expired-session',
          isActive: false
        })
      };

      const mockConnectionManager = {
        getSessionId: vi.fn().mockReturnValue('expired-session')
      };

      registry.register(mockHandler);
      
      const contextWithMocks = {
        ...mockContext,
        storage: mockStorage,
        connectionManager: mockConnectionManager
      };
      
      dispatcher = new MessageDispatcher(registry, contextWithMocks);

      const message = JSON.stringify({ type: 'register', data: 'test data' });
      await dispatcher.dispatch(mockWs, message);

      // Handler should be called even for expired session because register is exempt
      expect(mockHandler.handle).toHaveBeenCalled();
      
      // Should not send session_expired message for exempt types
      expect(mockWs.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"session_expired"')
      );
    });
  });
});
