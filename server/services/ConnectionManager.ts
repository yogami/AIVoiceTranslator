/**
 * Manages WebSocket connections, roles, and languages.
 */
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

export class ConnectionManager {
  private connections: Set<WebSocket> = new Set();

  constructor(private wss: any) {}

  addConnection(ws: WebSocket, request: IncomingMessage): WebSocket {
    console.log('New connection from', request.socket.remoteAddress);
    this.connections.add(ws);
    ws.on('close', () => this.removeConnection(ws));
    return ws;
  }

  removeConnection(ws: WebSocket): void {
    this.connections.delete(ws);
    console.log('Connection closed');
  }

  getConnections(): Set<WebSocket> {
    return this.connections;
  }
}