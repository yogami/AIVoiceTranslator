import { TranscriptionBusinessService, type ClientSettingsProvider } from '../../services/transcription/TranscriptionBusinessService';
import type { MessageHandlerContext } from '../../../interface-adapters/websocket/websocket-services/MessageHandler';

export class ManualTranslationService {
  constructor(private readonly transcriptionServiceFactory: (ctx: MessageHandlerContext) => TranscriptionBusinessService) {}

  async sendTextToStudents(text: string, context: MessageHandlerContext): Promise<void> {
    const sessionId = context.connectionManager.getSessionId(context.ws);
    const teacherLanguage = context.connectionManager.getLanguage(context.ws) || 'en-US';
    const { connections: studentConnections, languages: studentLanguages } =
      context.connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);

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

    const transcriptionService = this.transcriptionServiceFactory(context);
    await transcriptionService.processTranscription({
      text,
      teacherLanguage,
      sessionId,
      studentConnections,
      studentLanguages: Array.from(studentLanguages),
      startTime,
      latencyTracking
    }, clientProvider);
  }
}


