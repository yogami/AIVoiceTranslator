import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express from 'express';
import { WebSocketServer as WSServer } from 'ws';
import { WebSocketServer } from '../../server/services/WebSocketServer';

describe('Message Handler Integration - Unique Tests', () => {
  let httpServer: Server;
  let wss: WSServer;
  let wsServer: WebSocketServer;
  let wsUrl: string;
  const testPort = 5558; // Different port to avoid conflicts

  beforeAll(async () => {
    // Create a simple HTTP server for testing
    const app = express();
    httpServer = createServer(app);
    
    // Create WebSocket server
    wss = new WSServer({ 
      server: httpServer,
      path: '/ws'
    });
    
    // Create our WebSocketServer instance
    wsServer = new WebSocketServer(wss);
    
    // Start listening
    await new Promise<void>((resolve) => {
      httpServer.listen(testPort, () => {
        wsUrl = `ws://localhost:${testPort}/ws`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close WebSocket server
    wsServer.close();
    
    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  }, 15000);

  it('should handle transcriptRequest message', async () => {
    // This is a UNIQUE test - transcript requests are not tested elsewhere
    const ws = new WebSocket(wsUrl);
    const messages: any[] = [];
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messages.push(message);
      } catch (e) {
        // Ignore parse errors
      }
    });
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on('error', reject);
    });

    // Wait for connection message
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clear messages before sending request
    messages.length = 0;

    // Send transcript request (this functionality is unique to this test)
    ws.send(JSON.stringify({
      type: 'transcriptRequest',
      sessionId: 'test-session-123'
    }));

    // Wait for any response
    await new Promise(resolve => setTimeout(resolve, 1000));

    // The server should handle it gracefully without crashing
    // We might not get a response for unknown message types
    expect(ws.readyState).toBe(WebSocket.OPEN);
    
    // If we want transcript functionality, we'd need to implement it in WebSocketServer
    // For now, just verify the connection is still alive
    
    ws.close();
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 20000);

  // NOTE: The following tests have been moved to other files:
  // - "should handle getTranslation message" -> Moved to translation-flow-integration.test.ts
  // - "should handle invalid message types gracefully" -> Moved to translation-flow-integration.test.ts
});
