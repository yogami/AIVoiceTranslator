import logger from '../../../logger';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TeacherReplyMessageToServer } from '../WebSocketTypes';
import { config } from '../../../config';

export class TeacherReplyMessageHandler implements IMessageHandler<TeacherReplyMessageToServer> {
  getMessageType(): string {
    return 'teacher_reply';
  }

  async handle(message: TeacherReplyMessageToServer, context: MessageHandlerContext): Promise<void> {
    if (!config.features?.twoWayCommunication) return;
    try {
      const role = context.connectionManager.getRole(context.ws);
      if (role !== 'teacher') return;

      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) return;

      // MVP scope: reply to class by translating and delivering to all students
      const { TranscriptionBusinessService } = await import('../../../services/transcription/TranscriptionBusinessService');
      const service = new TranscriptionBusinessService(context.storage, context.speechPipelineOrchestrator);

      const teacherLanguage = context.connectionManager.getLanguage(context.ws) || 'en-US';
      let studentConnections: any[];
      let studentLanguages: string[];

      if (message.scope === 'private' && message.requestId) {
        const target = context.webSocketServer.getStudentForRequest(sessionId, message.requestId);
        studentConnections = target ? [target] : [];
        studentLanguages = target ? [context.connectionManager.getLanguage(target) || 'en'] : [];
      } else {
        const res = context.connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);
        studentConnections = res.connections;
        studentLanguages = res.languages;
      }

      await service.processTranscription(
        {
          text: message.text,
          teacherLanguage,
          sessionId,
          studentConnections,
          studentLanguages,
          startTime: Date.now(),
          latencyTracking: {
            start: Date.now(),
            components: { preparation: 0, translation: 0, tts: 0, processing: 0 }
          }
        },
        {
          getClientSettings: (ws: any) => context.connectionManager.getClientSettings(ws),
          getLanguage: (ws: any) => context.connectionManager.getLanguage(ws),
          getSessionId: (ws: any) => context.connectionManager.getSessionId(ws)
        }
      );
    } catch (error) {
      logger.error('TeacherReplyMessageHandler error', { error });
    }
  }
}


