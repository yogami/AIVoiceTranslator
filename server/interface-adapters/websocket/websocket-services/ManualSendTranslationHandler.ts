import logger from '../../../logger';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { ManualSendTranslationMessageToServer } from '../WebSocketTypes';
import { TranscriptionBusinessService, type ClientSettingsProvider } from '../../../services/transcription/TranscriptionBusinessService';

export class ManualSendTranslationHandler implements IMessageHandler<ManualSendTranslationMessageToServer> {
  getMessageType(): string {
    return 'send_translation';
  }

  async handle(message: ManualSendTranslationMessageToServer, context: MessageHandlerContext): Promise<void> {
    if (process.env.FEATURE_MANUAL_TRANSLATION_CONTROL !== '1') {
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

    if (!context.speechPipelineOrchestrator) {
      throw new Error('SpeechPipelineOrchestrator not available in context');
    }

    const teacherLanguage = context.connectionManager.getLanguage(context.ws) || 'en-US';
    const { connections: studentConnections, languages: studentLanguages } =
      context.connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);

    if (!message.text || !message.text.trim()) {
      logger.warn('[ManualMode] Empty text provided for manual send');
      return;
    }

    const startTime = Date.now();
    const latencyTracking = {
      start: startTime,
      components: { preparation: 0, translation: 0, tts: 0, processing: 0 }
    };

    const clientProvider: ClientSettingsProvider = {
      getClientSettings: (ws: any) => context.connectionManager.getClientSettings(ws),
      getLanguage: (ws: any) => context.connectionManager.getLanguage(ws),
      getSessionId: (ws: any) => context.connectionManager.getSessionId(ws)
    };

    const transcriptionService = new TranscriptionBusinessService(
      context.storage,
      context.speechPipelineOrchestrator
    );

    try {
      await transcriptionService.processTranscription({
        text: message.text,
        teacherLanguage,
        sessionId,
        studentConnections,
        studentLanguages: Array.from(studentLanguages),
        startTime,
        latencyTracking
      }, clientProvider);
    } catch (error) {
      logger.error('[ManualMode] Failed to process manual translation', { error });
    }
  }
}


