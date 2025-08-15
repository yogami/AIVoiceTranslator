import logger from '../../../logger';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { StudentAudioMessageToServer } from '../WebSocketTypes';
import { config } from '../../../config';

export class StudentAudioMessageHandler implements IMessageHandler<StudentAudioMessageToServer> {
  getMessageType(): string {
    return 'student_audio';
  }

  async handle(message: StudentAudioMessageToServer, context: MessageHandlerContext): Promise<void> {
    // Feature flag: allow via global or per-connection URL
    const settings = context.connectionManager.getClientSettings?.(context.ws) || {};
    const enabled = !!(config.features?.twoWayCommunication || (settings as any).twoWayEnabled);
    if (!enabled) return;

    try {
      const role = context.connectionManager.getRole(context.ws);
      if (role !== 'student') return;
      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) return;

      const studentLanguage = message.language || context.connectionManager.getLanguage(context.ws) || 'en';

      // If transcribedText provided (tests/dev), treat as student_request
      if (message.transcribedText && message.transcribedText.trim()) {
        this.deliverAsStudentRequest(context, sessionId, studentLanguage, message.transcribedText, message.visibility);
        return;
      }

      // Else, require audio data
      const audioData = message.data;
      if (!audioData || audioData.length < config.session.minAudioDataLength) return;
      const audioBuffer = Buffer.from(audioData, 'base64');
      if (audioBuffer.length < config.session.minAudioBufferLength) return;

      if (!context.speechPipelineOrchestrator) return;
      const text = await context.speechPipelineOrchestrator.transcribeAudio(audioBuffer, studentLanguage);
      if (!text || !text.trim()) return;
      this.deliverAsStudentRequest(context, sessionId, studentLanguage, text, message.visibility);
    } catch (e) {
      logger.warn('[StudentAudio] failed', { error: e });
    }
  }

  private deliverAsStudentRequest(
    context: MessageHandlerContext,
    sessionId: string,
    languageCode: string,
    text: string,
    visibility: 'private' | 'class' = 'private'
  ) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const name = context.connectionManager.getName?.(context.ws) || 'Unknown Student';
    const payload = {
      type: 'student_request',
      timestamp: Date.now(),
      payload: { requestId, name, languageCode, text, visibility }
    } as any;
    // deliver to teachers in same session
    const all = context.connectionManager.getConnections();
    for (const ws of all) {
      if (context.connectionManager.getRole(ws) === 'teacher' && context.connectionManager.getSessionId(ws) === sessionId) {
        try { ws.send(JSON.stringify(payload)); } catch {}
      }
    }
    try { context.webSocketServer.registerStudentRequest(sessionId, requestId, context.ws); } catch {}
  }
}


