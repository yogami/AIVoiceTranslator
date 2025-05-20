/**
 * WebSocketMessageRouter
 * 
 * Routes incoming WebSocket messages to appropriate handlers
 * - Follows Single Responsibility Principle
 * - Implements Chain of Responsibility pattern
 * - Standardizes error handling
 */

import { WebSocketClient, WebSocketClientManager } from './WebSocketClientManager';

// Base message handler interface
export interface WebSocketMessageHandler {
  canHandle(type: string): boolean;
  handle(client: WebSocketClient, message: any): Promise<boolean>;
}

// Base message interface
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export class WebSocketMessageRouter {
  private handlers: WebSocketMessageHandler[] = [];
  
  constructor(private clientManager: WebSocketClientManager) {}
  
  /**
   * Register a message handler
   */
  public registerHandler(handler: WebSocketMessageHandler): void {
    this.handlers.push(handler);
  }
  
  /**
   * Process an incoming message
   * Returns true if handled, false if no handler found
   */
  public async routeMessage(client: WebSocketClient, messageData: string): Promise<boolean> {
    try {
      // Parse message
      const message = JSON.parse(messageData) as WebSocketMessage;
      
      // Find appropriate handler
      for (const handler of this.handlers) {
        if (handler.canHandle(message.type)) {
          try {
            // Track message handling start time for performance metrics
            const startTime = Date.now();
            
            // Let the handler process the message
            const handled = await handler.handle(client, message);
            
            // Log performance metrics
            const duration = Date.now() - startTime;
            console.log(`Message type '${message.type}' handled in ${duration}ms`);
            
            // If handled successfully, stop processing
            if (handled) {
              return true;
            }
          } catch (error) {
            // Log error but continue trying other handlers
            console.error(`Error in handler for message type '${message.type}':`, error);
            
            // Send error response to client
            this.sendErrorResponse(client, message.type, error);
          }
        }
      }
      
      // If we get here, no handler was found or all handlers declined
      console.warn(`No handler found for message type: ${message.type}`);
      
      // Send unsupported message type response
      this.sendUnsupportedResponse(client, message.type);
      
      return false;
    } catch (error) {
      // Handle JSON parsing errors
      console.error('Error parsing WebSocket message:', error);
      
      // Send malformed message response
      this.sendMalformedResponse(client);
      
      return false;
    }
  }
  
  /**
   * Send error response to client
   */
  private sendErrorResponse(client: WebSocketClient, messageType: string, error: any): void {
    try {
      const errorResponse = {
        type: 'error',
        originalType: messageType,
        message: error.message || 'An error occurred processing your request',
        timestamp: Date.now()
      };
      
      client.send(JSON.stringify(errorResponse));
    } catch (sendError) {
      console.error('Error sending error response:', sendError);
    }
  }
  
  /**
   * Send unsupported message type response
   */
  private sendUnsupportedResponse(client: WebSocketClient, messageType: string): void {
    try {
      const response = {
        type: 'error',
        originalType: messageType,
        message: `Unsupported message type: ${messageType}`,
        timestamp: Date.now()
      };
      
      client.send(JSON.stringify(response));
    } catch (sendError) {
      console.error('Error sending unsupported message response:', sendError);
    }
  }
  
  /**
   * Send malformed message response
   */
  private sendMalformedResponse(client: WebSocketClient): void {
    try {
      const response = {
        type: 'error',
        message: 'Malformed message: Unable to parse JSON',
        timestamp: Date.now()
      };
      
      client.send(JSON.stringify(response));
    } catch (sendError) {
      console.error('Error sending malformed message response:', sendError);
    }
  }
}