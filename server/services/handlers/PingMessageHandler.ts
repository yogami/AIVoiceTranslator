/**
 * PingMessageHandler
 * 
 * Handles ping-pong heartbeat messages
 * - Follows Single Responsibility Principle
 * - Separates heartbeat logic from other message types
 */

import { WebSocketClient, WebSocketClientManager } from '../WebSocketClientManager';
import { WebSocketMessageHandler } from '../WebSocketMessageRouter';

export interface PingMessage {
  type: 'ping';
  timestamp?: number;
  // Additional fields that might be present
  [key: string]: any;
}

export class PingMessageHandler implements WebSocketMessageHandler {
  constructor(private clientManager: WebSocketClientManager) {}
  
  /**
   * Check if this handler can process the message type
   */
  public canHandle(type: string): boolean {
    return type === 'ping';
  }
  
  /**
   * Handle ping message
   */
  public async handle(client: WebSocketClient, message: any): Promise<boolean> {
    try {
      const pingMsg = message as PingMessage;
      const clientState = this.clientManager.getClientState(client);
      
      // Mark client as alive
      if (clientState) {
        this.clientManager.setClientAlive(client, true);
      }
      
      // Send pong response
      const response = {
        type: 'pong',
        timestamp: Date.now(),
        originalTimestamp: pingMsg.timestamp
      };
      
      client.send(JSON.stringify(response));
      return true;
    } catch (error) {
      console.error('Error handling ping message:', error);
      return false;
    }
  }
}