/**
 * WebSocket Response Service
 * 
 * Handles all WebSocket response formatting and sending logic.
 * Centralizes response construction to ensure consistency.
 */

import logger from '../../logger';
import { WebSocketClient } from './ConnectionManager';
import type {
  ErrorMessageToClient,
  ConnectionMessageToClient
} from '../WebSocketTypes';

export interface ValidationError {
  type: 'INVALID_CLASSROOM';
  message: string;
  closeCode: number;
  closeReason: string;
}

export class WebSocketResponseService {
  /**
   * Send an error response and close the connection
   */
  public sendErrorAndClose(ws: WebSocketClient, error: ValidationError): void {
    try {
      const errorMessage: ErrorMessageToClient = {
        type: 'error',
        message: error.message,
        code: error.type
      };
      
      ws.send(JSON.stringify(errorMessage));
      ws.close(error.closeCode, error.closeReason);
    } catch (sendError) {
      logger.error('Failed to send error response:', { error: sendError });
      // Still try to close the connection
      try {
        ws.close(error.closeCode, error.closeReason);
      } catch (closeError) {
        logger.error('Failed to close connection after error:', { error: closeError });
      }
    }
  }

  /**
   * Send connection confirmation message
   */
  public sendConnectionConfirmation(ws: WebSocketClient, sessionId: string, classroomCode?: string): void {
    try {
      const connectionMessage: ConnectionMessageToClient = {
        type: 'connection',
        status: 'connected',
        sessionId,
        ...(classroomCode && { classroomCode })
      };
      
      ws.send(JSON.stringify(connectionMessage));
    } catch (error) {
      logger.error('Error sending connection confirmation:', { error });
      // Don't close connection for this error - it's not critical
    }
  }

  /**
   * Send a generic message safely with error handling
   */
  public sendMessage(ws: WebSocketClient, message: any, context?: string): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Failed to send ${context || 'message'}:`, { error, message });
    }
  }
}
