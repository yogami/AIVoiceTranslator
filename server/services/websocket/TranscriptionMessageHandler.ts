/**
 * WebSocket Message Handler for Transcription
 * 
 * This is a LIGHTWEIGHT transport layer handler that:
 * 1. Validates message format and authorization
 * 2. Delegates business logic to TranscriptionBusinessService
 * 
 * Following Clean Architecture principles:
 * - WebSocket layer handles only transport concerns
 * - Business logic is delegated to domain services
 * - No TTS/STT/Translation logic in WebSocket layer
 */
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TranscriptionMessageToServer } from '../WebSocketTypes';
import type { WebSocketClient } from './ConnectionManager';
import { TranscriptionBusinessService, type ClientSettingsProvider } from '../transcription/TranscriptionBusinessService';
import logger from '../../logger';

export class TranscriptionMessageHandler implements IMessageHandler<TranscriptionMessageToServer> {
  getMessageType(): string {
    return 'transcription';
  }

  async handle(message: TranscriptionMessageToServer, context: MessageHandlerContext): Promise<void> {
    logger.info('Received transcription from', { 
      role: context.connectionManager.getRole(context.ws), 
      text: message.text 
    });
    
    const role = context.connectionManager.getRole(context.ws);
    const sessionId = context.connectionManager.getSessionId(context.ws);
    
    // Create business service instance
    if (!context.speechPipelineOrchestrator) {
      throw new Error('SpeechPipelineOrchestrator not available in context');
    }
    
    const transcriptionService = new TranscriptionBusinessService(
      context.storage,
      context.speechPipelineOrchestrator
    );
    
    // Validate transcription source
    const validation = transcriptionService.validateTranscriptionSource(role);
    if (!validation.valid) {
      logger.warn(validation.reason);
      return;
    }
    
    if (!sessionId) {
      logger.warn('No session ID found for transcription');
      return;
    }
    
    // Prepare request data
    const startTime = Date.now();
    const latencyTracking = {
      start: startTime,
      components: {
        preparation: 0,
        translation: 0,
        tts: 0,
        processing: 0
      }
    };
    
    const teacherLanguage = context.connectionManager.getLanguage(context.ws) || 'en-US';
    
    // Get student connections and languages
    const { connections: studentConnections, languages: studentLanguages } = 
      context.connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);
    
    // Create client settings provider
    const clientProvider: ClientSettingsProvider = {
      getClientSettings: (ws: WebSocketClient) => context.connectionManager.getClientSettings(ws),
      getLanguage: (ws: WebSocketClient) => context.connectionManager.getLanguage(ws),
      getSessionId: (ws: WebSocketClient) => context.connectionManager.getSessionId(ws)
    };
    
    // Delegate to business service
    try {
      await transcriptionService.processTranscription({
        text: message.text,
        teacherLanguage,
        sessionId,
        studentConnections,
        studentLanguages: Array.from(studentLanguages), // Convert Set to Array
        startTime,
        latencyTracking
      }, clientProvider);
    } catch (error) {
      logger.error('Error in transcription message handling:', { 
        error, 
        errorMessage: error instanceof Error ? error.message : String(error), 
        errorStack: error instanceof Error ? error.stack : undefined 
      });
      // Extra error logging for integration test visibility
      console.error('[TranscriptionMessageHandler] Exception:', error, error instanceof Error ? error.stack : undefined, error instanceof Error ? error.message : String(error));
      // Re-throw to be caught by MessageHandler
      throw error;
    }
  }
}
