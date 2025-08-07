/**
 * Audio WebSocket Transport Handler
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
 * - NO audio processing logic (delegated to orchestrator via domain handler)
 * - Only transport layer concerns
 */

import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { AudioMessageToServer } from '../WebSocketTypes';
import { AudioProcessingDomainHandler } from '../speech/audio/AudioProcessingDomainHandler';
import logger from '../../logger';

export class AudioTransportHandler implements IMessageHandler<AudioMessageToServer> {
  getMessageType(): string {
    return 'audio';
  }

  async handle(message: AudioMessageToServer, context: MessageHandlerContext): Promise<void> {
    try {
      // Transport layer concerns: extract session info
      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) {
        logger.warn('Audio message received without session ID');
        return;
      }

      // Transport layer concerns: extract user role
      const role = context.connectionManager.getRole(context.ws);
      if (!role) {
        logger.warn('Audio message received from unregistered user', { sessionId });
        return;
      }

      // Ensure SpeechPipelineOrchestrator is available
      if (!context.speechPipelineOrchestrator) {
        logger.error('SpeechPipelineOrchestrator not available for audio processing', { sessionId });
        return;
      }

      // Delegate to domain handler
      const domainHandler = new AudioProcessingDomainHandler(context.speechPipelineOrchestrator);
      await domainHandler.handle(message, sessionId, role);
      
    } catch (error) {
      logger.error('Transport error in audio message handling:', { error });
    }
  }
}
