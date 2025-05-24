/**
 * Unit tests for MessageHandler
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageHandler } from '../../../server/services/handlers/MessageHandler';
import { ConnectionManager } from '../../../server/services/managers/ConnectionManager';
import { WebSocket } from 'ws';
import { createMockWebSocketClient } from '../utils/test-helpers';

// Define a type for the mock call to avoid compilation issues
type MockCall = [string, (data: any) => void];

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;
  let connectionManager: ConnectionManager;
  let mockWS: WebSocket;
  let messageHandler_fn: any;

  beforeEach(() => {
    connectionManager = new ConnectionManager({ clients: new Set() } as any);
    messageHandler = new MessageHandler(connectionManager);
    // Use our helper to create a mock WebSocket client
    mockWS = createMockWebSocketClient() as unknown as WebSocket;
  });

  it('should handle register message', () => {
    messageHandler.attachHandlers(mockWS);
    
    // Capture the message handler function when on('message') is called
    expect(mockWS.on).toHaveBeenCalledWith('message', expect.any(Function));
    messageHandler_fn = (mockWS.on as any).mock.calls.find((call: MockCall) => call[0] === 'message')[1];
    
    // Directly call the message handler function with the message data
    messageHandler_fn(JSON.stringify({ type: 'register' }));
    
    expect(mockWS.send).toHaveBeenCalledWith(JSON.stringify({ type: 'registration', success: true }));
  });

  it('should handle ping message', () => {
    messageHandler.attachHandlers(mockWS);
    
    // Capture the message handler function
    expect(mockWS.on).toHaveBeenCalledWith('message', expect.any(Function));
    messageHandler_fn = (mockWS.on as any).mock.calls.find((call: MockCall) => call[0] === 'message')[1];
    
    // Directly call the message handler function with the message data
    messageHandler_fn(JSON.stringify({ type: 'ping' }));
    
    expect(mockWS.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
  });
});