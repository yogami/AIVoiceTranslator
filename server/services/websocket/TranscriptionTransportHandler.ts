/**
 * Transcription WebSocket Transport Handler
 * 
 * Clean Architecture Transport Layer Handler
 * 
 * This handler is responsible ONLY for:
 * 1. WebSocket transport concerns (message parsing)
 * 2. Session validation and authorization
 * 3. Delegating to domain handler
 * 
 * Clean Architecture Principles:
 * - NO business logic (delegated to domain handler)
 * - NO transcription processing logic (delegated to orchestrator via domain handler)
 * - Only transport layer concerns
 */

import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TranscriptionMessageToServer } from '../WebSocketTypes';
import { TranscriptionDomainHandler } from '../speech/transcription/TranscriptionDomainHandler';
import logger from '../../logger';

export class TranscriptionTransportHandler implements IMessageHandler<TranscriptionMessageToServer> {
  getMessageType(): string {
    return 'transcription';
  }

  async handle(message: TranscriptionMessageToServer, context: MessageHandlerContext): Promise<void> {
    try {
      // Transport layer concerns: extract session info
      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) {
        logger.warn('Transcription message received without session ID');
        return;
      }

      // Transport layer concerns: extract user info
      const role = context.connectionManager.getRole(context.ws);
      const languageCode = context.connectionManager.getLanguage(context.ws);
      
      if (!role) {
        logger.warn('Transcription message received from unregistered user', { sessionId });
        return;
      }

      // Ensure SpeechPipelineOrchestrator is available
      if (!context.speechPipelineOrchestrator) {
        logger.error('SpeechPipelineOrchestrator not available for transcription processing', { sessionId });
        return;
      }

      // Delegate to domain handler
      const domainHandler = new TranscriptionDomainHandler(context.speechPipelineOrchestrator);
      await domainHandler.handle(message, sessionId, role, languageCode || 'en-US');
      
    } catch (error) {
      logger.error('Transport error in transcription message handling:', { error });
    }
  }
}
