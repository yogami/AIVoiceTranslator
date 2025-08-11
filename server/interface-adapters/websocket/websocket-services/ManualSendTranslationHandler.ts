import logger from '../../../logger';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { ManualSendTranslationMessageToServer } from '../WebSocketTypes';
import { ManualTranslationService } from '../../../application/services/manual/ManualTranslationService';

export class ManualSendTranslationHandler implements IMessageHandler<ManualSendTranslationMessageToServer> {
  getMessageType(): string {
    return 'send_translation';
  }

  async handle(message: ManualSendTranslationMessageToServer, context: MessageHandlerContext): Promise<void> {
    const { FeatureFlags } = await import('../../../application/services/config/FeatureFlags');
    if (!FeatureFlags.MANUAL_TRANSLATION_CONTROL) {
      // Feature disabled: ignore silently to avoid breaking clients
      return;
    }

    const role = context.connectionManager.getRole(context.ws);
    if (role !== 'teacher') {
      logger.warn('[ManualMode] Non-teacher attempted manual send');
      return;
    }

    const sessionId = context.connectionManager.getSessionId(context.ws);
    if (!sessionId) {
      logger.warn('[ManualMode] Missing sessionId for manual send');
      return;
    }

    if (!message.text || !message.text.trim()) {
      logger.warn('[ManualMode] Empty text provided for manual send');
      return;
    }

    try {
      const service = new ManualTranslationService((ctx) => new (require('../../../services/transcription/TranscriptionBusinessService').TranscriptionBusinessService)(ctx.storage, ctx.speechPipelineOrchestrator));
      await service.sendTextToStudents(message.text, context);
      // Acknowledge to teacher
      try { context.ws.send(JSON.stringify({ type: 'manual_send_ack', status: 'ok' })); } catch(_){ }
    } catch (error) {
      logger.error('[ManualMode] Failed to process manual translation', { error });
      try { context.ws.send(JSON.stringify({ type: 'manual_send_ack', status: 'error', message: 'Failed to send translation' })); } catch(_){ }
    }
  }
}


