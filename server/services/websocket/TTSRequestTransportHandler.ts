/**
 * TTS Request WebSocket Transport Handler
 * 
 * Clean Architecture Transport Layer Handler
 * 
 * This handler is responsible ONLY for:
 * 1. WebSocket transport concerns (message parsing, response sending)
 * 2. Session validation and authorization
 * 3. Delegating to domain handler
 * 
 * Clean Architecture Principles:
 * - NO business logic (delegated to domain handler)
 * - NO TTS generation logic (delegated to orchestrator via domain handler)
 * - Only transport layer concerns
 */

import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TTSRequestMessageToServer, TTSResponseMessageToClient } from '../WebSocketTypes';
import { TTSRequestDomainHandler } from '../speech/tts/TTSRequestDomainHandler';
import logger from '../../logger';

export class TTSRequestTransportHandler implements IMessageHandler<TTSRequestMessageToServer> {
  getMessageType(): string {
    return 'tts_request';
  }

  async handle(message: TTSRequestMessageToServer, context: MessageHandlerContext): Promise<void> {
    try {
      // Transport layer concerns: extract session info
      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) {
        await this.sendErrorResponse(context, 'No session ID found');
        return;
      }

      // Transport layer concerns: validate user authorization
      const role = context.connectionManager.getRole(context.ws);
      if (!role) {
        await this.sendErrorResponse(context, 'User not registered');
        return;
      }

      // Ensure SpeechPipelineOrchestrator is available
      if (!context.speechPipelineOrchestrator) {
        await this.sendErrorResponse(context, 'Speech service unavailable');
        return;
      }

      // Delegate to domain handler
      const domainHandler = new TTSRequestDomainHandler(context.speechPipelineOrchestrator);
      const response = await domainHandler.handle(message, sessionId);
      
      // Transport layer concerns: send response via WebSocket
      await this.sendResponse(context, response);
      
    } catch (error) {
      logger.error('Transport error in TTS request handling:', { error });
      await this.sendErrorResponse(context, 'Internal server error');
    }
  }

  /**
   * Transport layer: Send TTS response via WebSocket
   */
  private async sendResponse(context: MessageHandlerContext, response: TTSResponseMessageToClient): Promise<void> {
    try {
      context.ws.send(JSON.stringify(response));
      
      if (response.status === 'success') {
        logger.info(`TTS response sent successfully for language '${response.languageCode}'`);
      } else {
        logger.error(`TTS error response sent: ${response.error?.message}`);
      }
    } catch (error) {
      logger.error('Error sending TTS response via WebSocket:', { error });
    }
  }

  /**
   * Transport layer: Send error response via WebSocket
   */
  private async sendErrorResponse(context: MessageHandlerContext, messageText: string): Promise<void> {
    try {
      const errorResponse: TTSResponseMessageToClient = {
        type: 'tts_response',
        status: 'error',
        error: {
          message: messageText,
          code: 'TRANSPORT_ERROR'
        },
        timestamp: Date.now()
      };
      
      context.ws.send(JSON.stringify(errorResponse));
      logger.error(`TTS transport error response sent: ${messageText}`);
    } catch (error) {
      logger.error('Error sending TTS error response via WebSocket:', { error });
    }
  }
}
