/**
 * Transcription Domain Handler
 * 
 * Clean Architecture Domain Layer Handler for Transcription Processing
 * 
 * This handler contains the business logic for processing transcriptions.
 * It delegates to the SpeechPipelineOrchestrator for transcription processing.
 * 
 * Clean Architecture Principles:
 * - Contains transcription processing business logic and validation
 * - Delegates to SpeechPipelineOrchestrator for transcription processing
 * - Independent of transport layer (WebSocket) concerns
 * - Can be tested independently
 */

import type { TranscriptionMessageToServer } from '../../WebSocketTypes';
import logger from '../../../logger';

export interface ITranscriptionDomainHandler {
  handle(message: TranscriptionMessageToServer, sessionId: string, role: string, languageCode: string): Promise<void>;
}

export class TranscriptionDomainHandler implements ITranscriptionDomainHandler {
  constructor(
    private speechPipelineOrchestrator: any // SpeechPipelineOrchestrator
  ) {}

  async handle(
    message: TranscriptionMessageToServer, 
    sessionId: string, 
    role: string, 
    languageCode: string
  ): Promise<void> {
    logger.info('Processing transcription', { 
      role, 
      sessionId, 
      text: message.text 
    });
    
    try {
      // Validate transcription message
      if (!this.validateTranscriptionMessage(message)) {
        logger.warn('Invalid transcription message format', { sessionId });
        return;
      }
      
      // Delegate to SpeechPipelineOrchestrator for transcription processing
      await this.speechPipelineOrchestrator.processTranscription({
        text: message.text,
        timestamp: message.timestamp,
        isFinal: message.isFinal,
        sessionId,
        role,
        languageCode
      });
      
    } catch (error) {
      logger.error('Error processing transcription:', { error, sessionId });
    }
  }

  /**
   * Validate transcription message format
   */
  private validateTranscriptionMessage(message: TranscriptionMessageToServer): boolean {
    if (!message.text || typeof message.text !== 'string') {
      return false;
    }
    
    if (message.text.trim().length === 0) {
      return false;
    }
    
    // Optional validation for timestamp
    if (message.timestamp && typeof message.timestamp !== 'number') {
      return false;
    }
    
    return true;
  }
}
