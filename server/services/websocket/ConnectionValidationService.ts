/**
 * Connection Validation Service
 * 
 * Handles validation of incoming WebSocket connections and constructs
 * appropriate error responses. Separates validation logic from the
 * main WebSocketServer orchestrator.
 */

import logger from '../../logger';
import { WebSocketClient } from './ConnectionManager';
import { ClassroomSessionManager } from '../session/ClassroomSessionManager';
import { WebSocketResponseService, type ValidationError } from './WebSocketResponseService';

export interface ValidationResult {
  isValid: boolean;
  error?: ValidationError;
}

export class ConnectionValidationService {
  private responseService: WebSocketResponseService;

  constructor(private classroomSessionManager: ClassroomSessionManager) {
    this.responseService = new WebSocketResponseService();
  }

  /**
   * Validate a WebSocket connection with optional classroom code
   */
  validateConnection(classroomCode?: string): ValidationResult {
    // If no classroom code provided, connection is valid
    if (!classroomCode) {
      return { isValid: true };
    }

    // Validate classroom code
    if (!this.classroomSessionManager.isValidClassroomCode(classroomCode)) {
      logger.warn(`Invalid classroom code attempted: ${classroomCode}`);
      
      return {
        isValid: false,
        error: {
          type: 'INVALID_CLASSROOM',
          message: 'Classroom session expired or invalid. Please ask teacher for new link.',
          closeCode: 1008,
          closeReason: 'Invalid classroom session'
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Send validation error response and close connection
   */
  handleValidationError(ws: WebSocketClient, error: ValidationResult['error']): void {
    if (!error) return;

    this.responseService.sendErrorAndClose(ws, error);
  }
}
