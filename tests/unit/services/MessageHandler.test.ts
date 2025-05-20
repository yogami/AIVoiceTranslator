/**
 * Unit tests for MessageHandler
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { MessageHandler } from '../../../server/services/MessageHandler';
import { ConnectionManager } from '../../../server/services/ConnectionManager';
import { WebSocket } from 'ws';

class MockWebSocket extends WebSocket {
  constructor() {
    super('ws://localhost');
  }
}

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;
  let connectionManager: ConnectionManager;
  let mockWS: MockWebSocket;

  beforeEach(() => {
    connectionManager = new ConnectionManager({ clients: new Set() } as any);
    messageHandler = new MessageHandler(connectionManager);
    mockWS = new MockWebSocket();
  });

  it('should handle register message', () => {
    const spySend = vi.spyOn(mockWS, 'send');
    messageHandler.attachHandlers(mockWS);
    mockWS.emit('message', JSON.stringify({ type: 'register' }));
    expect(spySend).toHaveBeenCalledWith(JSON.stringify({ type: 'registration', success: true }));
  });

  it('should handle ping message', () => {
    const spySend = vi.spyOn(mockWS, 'send');
    messageHandler.attachHandlers(mockWS);
    mockWS.emit('message', JSON.stringify({ type: 'ping' }));
    expect(spySend).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
  });
});