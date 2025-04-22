/**
 * WebSocket Utilities
 * 
 * Helper functions for WebSocket operations
 */
import { WebSocketServer as WSServer } from 'ws';
import { Server } from 'http';

/**
 * Create a WebSocket server attached to an HTTP server
 */
export function createWebSocketServer(server: Server, path: string = '/ws'): WSServer {
  const wss = new WSServer({ server, path });
  
  console.log(`WebSocket server created and listening on path: ${path}`);
  
  // Set up heartbeat mechanism
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  // Setup connection handler
  wss.on('connection', (ws: any, request) => {
    console.log('New WebSocket connection');
    
    ws.isAlive = true;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', (message: any) => {
      try {
        console.log('Received message:', message.toString().substring(0, 100));
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
    
    // Send a welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: Date.now()
    }));
  });
  
  return wss;
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcastMessage(wss: WSServer, message: any): void {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

/**
 * Send a message to a specific client
 */
export function sendToClient(client: WebSocket, message: any): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}