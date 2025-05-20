/**
 * WebSocketMessageRouter Unit Tests
 * 
 * Tests the message routing functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketMessageRouter, WebSocketMessageHandler } from '../../../server/services/WebSocketMessageRouter';
import { WebSocketClientManager, WebSocketClient } from '../../../server/services/WebSocketClientManager';

// Mock WebSocket client implementation
class MockWebSocketClient {
  isAlive: boolean = true;
  sessionId?: string;
  send: ReturnType<typeof vi.fn> = vi.fn();
  on: ReturnType<typeof vi.fn> = vi.fn(() => this);
  terminate: ReturnType<typeof vi.fn> = vi.fn();
  ping: ReturnType<typeof vi.fn> = vi.fn();
}

// Mock message handler implementation
class MockMessageHandler implements WebSocketMessageHandler {
  handleResult: boolean;
  error?: Error;
  
  constructor(handleResult: boolean = true, error?: Error) {
    this.handleResult = handleResult;
    this.error = error;
  }
  
  canHandle = vi.fn((type: string) => type === 'test');
  handle = vi.fn(async () => {
    if (this.error) throw this.error;
    return this.handleResult;
  });
}

describe('WebSocketMessageRouter', () => {
  let router: WebSocketMessageRouter;
  let clientManager: WebSocketClientManager;
  let mockClient: WebSocketClient;
  let mockHandler: MockMessageHandler;
  
  beforeEach(() => {
    clientManager = new WebSocketClientManager();
    router = new WebSocketMessageRouter(clientManager);
    mockClient = new MockWebSocketClient() as unknown as WebSocketClient;
    mockHandler = new MockMessageHandler();
    
    // Register the mock handler
    router.registerHandler(mockHandler);
    
    // Register the client
    clientManager.registerClient(mockClient);
  });
  
  describe('routeMessage', () => {
    it('should route messages to the appropriate handler', async () => {
      const message = JSON.stringify({ type: 'test', data: 'hello' });
      const result = await router.routeMessage(mockClient, message);
      
      expect(result).toBe(true);
      expect(mockHandler.canHandle).toHaveBeenCalledWith('test');
      expect(mockHandler.handle).toHaveBeenCalled();
    });
    
    it('should handle JSON parsing errors', async () => {
      const invalidJson = '{invalid json';
      const result = await router.routeMessage(mockClient, invalidJson);
      
      expect(result).toBe(false);
      expect(mockClient.send).toHaveBeenCalled();
      
      // Verify error message format
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.message).toContain('Malformed message');
    });
    
    it('should handle unknown message types', async () => {
      const message = JSON.stringify({ type: 'unknown', data: 'hello' });
      const result = await router.routeMessage(mockClient, message);
      
      expect(result).toBe(false);
      expect(mockClient.send).toHaveBeenCalled();
      
      // Verify error message format
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.originalType).toBe('unknown');
      expect(sentMessage.message).toContain('Unsupported message type');
    });
    
    it('should handle handler errors', async () => {
      // Create a handler that throws an error
      const errorHandler = new MockMessageHandler(true, new Error('Handler error'));
      router = new WebSocketMessageRouter(clientManager);
      router.registerHandler(errorHandler);
      
      const message = JSON.stringify({ type: 'test', data: 'hello' });
      const result = await router.routeMessage(mockClient, message);
      
      expect(result).toBe(false);
      expect(mockClient.send).toHaveBeenCalled();
      
      // Verify error message format
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.originalType).toBe('test');
      expect(sentMessage.message).toBe('Handler error');
    });
    
    it('should try multiple handlers until one succeeds', async () => {
      // First handler declines to handle the message
      const declineHandler = new MockMessageHandler(false);
      
      // Second handler accepts the message
      const acceptHandler = new MockMessageHandler(true);
      
      router = new WebSocketMessageRouter(clientManager);
      router.registerHandler(declineHandler);
      router.registerHandler(acceptHandler);
      
      const message = JSON.stringify({ type: 'test', data: 'hello' });
      const result = await router.routeMessage(mockClient, message);
      
      expect(result).toBe(true);
      expect(declineHandler.handle).toHaveBeenCalled();
      expect(acceptHandler.handle).toHaveBeenCalled();
    });
  });
});