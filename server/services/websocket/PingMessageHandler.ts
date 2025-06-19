/**
 * Ping Message Handler
 * 
 * Handles ping messages for heartbeat functionality.
 * Marks connections as alive and sends pong responses.
 */

import logger from '../../logger';
import { WebSocketClient } from './ConnectionManager';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type {
  PingMessageToServer,
  PongMessageToClient
} from '../WebSocketTypes';

export class PingMessageHandler implements IMessageHandler<PingMessageToServer> {
  getMessageType(): string {
    return 'ping';
  }

  async handle(message: PingMessageToServer, context: MessageHandlerContext): Promise<void> {
    // Mark as alive for heartbeat
    context.ws.isAlive = true;
    
    // Send pong response
    const response: PongMessageToClient = {
      type: 'pong',
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    };
    
    try {
      context.ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error('Error sending pong response:', { error });
    }
  }
}
