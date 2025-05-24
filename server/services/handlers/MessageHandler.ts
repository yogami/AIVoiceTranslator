/**
 * Handles incoming WebSocket messages and routes them to appropriate handlers.
 */
import { WebSocket } from 'ws';
import { ConnectionManager } from '@managers/ConnectionManager';

export class MessageHandler {
  constructor(private connectionManager: ConnectionManager) {}

  attachHandlers(ws: WebSocket): void {
    ws.on('message', (data) => this.handleMessage(ws, data.toString()));
    ws.on('pong', () => (ws as any).isAlive = true);
  }

  private async handleMessage(ws: WebSocket, data: string): Promise<void> {
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case 'register':
          this.handleRegister(ws, message);
          break;
        case 'ping':
          this.handlePing(ws);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private handleRegister(ws: WebSocket, message: any): void {
    console.log('Handling register message:', message);
    ws.send(JSON.stringify({ type: 'registration', success: true }));
  }

  private handlePing(ws: WebSocket): void {
    ws.send(JSON.stringify({ type: 'pong' }));
  }
}

/**
 * Type declaration for MessageHandler to ensure TypeScript recognizes the module.
 */
export {};