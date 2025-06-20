/**
 * Message Handler Infrastructure
 * 
 * Provides a strategy pattern-based system for handling different WebSocket message types.
 * This allows for clean separation of concerns and easy extensibility.
 */

import logger from '../../logger';
import { WebSocketClient } from './ConnectionManager';
import type {
  WebSocketMessageToServer,
  RegisterMessageToServer,
  TranscriptionMessageToServer,
  AudioMessageToServer,
  TTSRequestMessageToServer,
  SettingsMessageToServer,
  PingMessageToServer
} from '../WebSocketTypes';

/**
 * Context interface providing access to WebSocket server dependencies
 */
export interface MessageHandlerContext {
  ws: WebSocketClient;
  connectionManager: any; // ConnectionManager - using any to avoid circular dependency
  storage: any; // IStorage - using any to avoid circular dependency  
  sessionService: any; // SessionService - using any to avoid circular dependency
  translationService: any; // TranslationOrchestrator - using any to avoid circular dependency
  classroomSessions: Map<string, any>; // ClassroomSession map - will be removed once fully migrated
  webSocketServer: any; // WebSocketServer - using any to avoid circular dependency
}

/**
 * Base interface for all message handlers
 */
export interface IMessageHandler<T extends WebSocketMessageToServer = WebSocketMessageToServer> {
  /**
   * Handle the specific message type
   */
  handle(message: T, context: MessageHandlerContext): Promise<void>;
  
  /**
   * Get the message type this handler processes
   */
  getMessageType(): string;
}

/**
 * Message handler registry for managing and dispatching messages
 */
export class MessageHandlerRegistry {
  private handlers = new Map<string, IMessageHandler>();

  /**
   * Register a message handler for a specific message type
   */
  register<T extends WebSocketMessageToServer>(handler: IMessageHandler<T>): void {
    this.handlers.set(handler.getMessageType(), handler);
  }

  /**
   * Get a handler for a specific message type
   */
  getHandler(messageType: string): IMessageHandler | undefined {
    return this.handlers.get(messageType);
  }

  /**
   * Check if a handler exists for a message type
   */
  hasHandler(messageType: string): boolean {
    return this.handlers.has(messageType);
  }

  /**
   * Get all registered message types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Message dispatcher that coordinates message handling
 */
export class MessageDispatcher {
  constructor(
    private registry: MessageHandlerRegistry,
    private context: MessageHandlerContext
  ) {}

  /**
   * Dispatch a message to the appropriate handler
   */
  async dispatch(ws: WebSocketClient, data: string): Promise<void> {
    try {
      // Parse message data
      const message = JSON.parse(data) as WebSocketMessageToServer;
      
      // Get handler for this message type
      const handler = this.registry.getHandler(message.type);
      
      if (handler) {
        // Add ws to context for this call
        const contextWithWs = { ...this.context, ws };
        await handler.handle(message, contextWithWs);
      } else {
        // Log unknown message types
        logger.warn('Unknown message type:', { type: message.type });
      }
    } catch (error) {
      logger.error('Error handling message:', { error, data });
    }
  }
}
