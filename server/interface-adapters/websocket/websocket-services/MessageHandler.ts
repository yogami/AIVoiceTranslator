/**
 * Message Handler Infrastructure
 * 
 * Provides a strategy pattern-based system for handling different WebSocket message types.
 * This allows for clean separation of concerns and easy extensibility.
 */

import logger from '../../../logger';
import { config } from '../../../config';
import { WebSocketClient } from './ConnectionManager';
import type {
  WebSocketMessageToServer,
  RegisterMessageToServer,
  TranscriptionMessageToServer,
  AudioMessageToServer,
  TTSRequestMessageToServer,
  SettingsMessageToServer,
  ManualSendTranslationMessageToServer,
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
  translationService: any; // Legacy service - using any to avoid circular dependency (may be removed)
  speechPipelineOrchestrator?: any; // SpeechPipelineOrchestrator - new orchestrator architecture
  sessionLifecycleService: any; // SessionLifecycleService - using any to avoid circular dependency
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
      
      // Skip session validation for certain message types that don't require active sessions
      const skipValidation = ['register', 'ping', 'pong'].includes(message.type);
      
      if (!skipValidation) {
        // Validate session is still active for non-exempt message types
        const sessionId = this.context.connectionManager.getSessionId(ws);
        if (sessionId) {
          try {
            const session = await this.context.storage.getSessionById(sessionId);
            if (!session || !session.isActive) {
              // Session has expired - notify client and close connection
              const errorResponse = {
                type: 'session_expired',
                message: 'Your class session has ended. Please ask your teacher for a new link.',
                code: 'SESSION_EXPIRED'
              };
              ws.send(JSON.stringify(errorResponse));
              
              // Close connection after a brief delay
              setTimeout(() => {
                if (typeof ws.close === 'function') {
                  ws.close(1008, 'Session expired');
                }
              }, config.session.sessionExpiredMessageDelay);
              
              logger.info(`Rejected message from expired session: ${sessionId}`);
              return;
            }
          } catch (error) {
            logger.error('Error validating session:', { sessionId, error });
          }
        }
      }
      
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
      // Extra error logging for integration test visibility
      console.error('[MessageHandler] Exception:', error, error instanceof Error ? error.stack : undefined, error instanceof Error ? error.message : String(error));
    }
  }
}
