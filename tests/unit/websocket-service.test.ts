/**
 * WebSocketService Unit Tests
 * 
 * Tests the WebSocket service functionality through public APIs only.
 * External dependencies (ws package) are mocked, but the SUT is not.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocketService, createWebSocketServer, broadcastMessage, sendToClient, WebSocketState, ExtendedWebSocket, WebSocketMessage } from '../../server/websocket';
import { Server } from 'http';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// Mock only the external ws package, not the SUT
vi.mock('ws', () => {
  const mockWebSocketServer = vi.fn().mockImplementation((options: any) => {
    const wss = {
      on: vi.fn(),
      clients: new Set(),
      handleUpgrade: vi.fn(),
      emit: vi.fn()
    };
    
    if (options.server && typeof options.server.on === 'function') {
      options.server.on('upgrade', (request: any, socket: any, head: any) => {
        wss.handleUpgrade(request, socket, head, (ws: any) => {
          wss.emit('connection', ws, request);
        });
      });
    }
    
    return wss;
  });
  
  return {
    WebSocketServer: mockWebSocketServer,
    WebSocket: vi.fn()
  };
});

describe('WebSocket Service Public API', () => {
  let mockHttpServer: Server;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockHttpServer = {
      on: vi.fn()
    } as any;
  });
  
  describe('createWebSocketServer - creates and configures WebSocket server', () => {
    it('should create a WebSocket server with the provided HTTP server', () => {
      const wss = createWebSocketServer(mockHttpServer);
      
      expect(wss).toBeDefined();
      expect(mockHttpServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
    });
  });
  
  describe('broadcastMessage - sends message to all connected clients', () => {
    it('should broadcast a message to all clients in OPEN state', () => {
      const mockClient1 = { readyState: WebSocketState.OPEN, send: vi.fn() };
      const mockClient2 = { readyState: WebSocketState.OPEN, send: vi.fn() };
      const mockClient3 = { readyState: WebSocketState.CLOSED, send: vi.fn() };
      
      const mockWss = {
        clients: new Set([mockClient1, mockClient2, mockClient3])
      };
      
      const message: WebSocketMessage = { type: 'test', data: 'hello' };
      broadcastMessage(mockWss as any, message);
      
      expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockClient2.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockClient3.send).not.toHaveBeenCalled();
    });
  });
  
  describe('sendToClient - sends message to a specific client', () => {
    it('should send message to client if connection is OPEN', () => {
      const mockClient = { readyState: WebSocketState.OPEN, send: vi.fn() };
      const message: WebSocketMessage = { type: 'test', data: 'hello' };
      
      sendToClient(mockClient as any, message);
      
      expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should not send message if connection is not OPEN', () => {
      const mockClient = { readyState: WebSocketState.CLOSED, send: vi.fn() };
      const message: WebSocketMessage = { type: 'test', data: 'hello' };
      
      sendToClient(mockClient as any, message);
      
      expect(mockClient.send).not.toHaveBeenCalled();
    });
  });
});
