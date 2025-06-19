import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TranscriptionMessageToServer } from '../WebSocketTypes';
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
    
    // Start tracking latency when transcription is received
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
    
    const role = context.connectionManager.getRole(context.ws);
    const sessionId = context.connectionManager.getSessionId(context.ws);
    
    // Only process transcriptions from teacher
    if (role !== 'teacher') {
      logger.warn('Ignoring transcription from non-teacher role:', { role });
      return;
    }
    
    // Get all student connections and their languages
    const { connections: studentConnections, languages: studentLanguages } = 
      context.connectionManager.getStudentConnectionsAndLanguages();
    
    if (studentConnections.length === 0) {
      logger.info('No students connected, skipping translation');
      return;
    }
    
    // Translate text to all student languages
    const teacherLanguage = context.connectionManager.getLanguage(context.ws) || 'en-US';
    
    // Perform translations for all required languages
    const { translations, translationResults, latencyInfo } = 
      await context.webSocketServer.translateToMultipleLanguages(
        message.text, 
        teacherLanguage, 
        studentLanguages,
        startTime,
        latencyTracking
      );
    
    // Update latency tracking with the results
    Object.assign(latencyTracking.components, latencyInfo);
    
    // Calculate processing latency before sending translations
    const processingEndTime = Date.now();
    latencyTracking.components.processing = processingEndTime - startTime - latencyTracking.components.translation;
    
    // Send translations to students
    context.webSocketServer.sendTranslationsToStudents(
      studentConnections,
      message.text,
      teacherLanguage,
      translations,
      translationResults,
      startTime,
      latencyTracking
    );
  }
}
