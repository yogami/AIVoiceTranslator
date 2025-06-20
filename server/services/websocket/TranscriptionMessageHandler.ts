import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TranscriptionMessageToServer } from '../WebSocketTypes';
import type { WebSocketClient } from './ConnectionManager';
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
    
    // Store the transcript in the database
    if (sessionId) {
      const teacherLanguage = context.connectionManager.getLanguage(context.ws) || 'en-US';
      try {
        await context.storage.addTranscript({
          sessionId,
          language: teacherLanguage,
          text: message.text
        });
        logger.info('Transcript stored successfully', { sessionId, language: teacherLanguage });
      } catch (error) {
        logger.error('Failed to store transcript:', { error, sessionId });
        // Continue with translation - don't break core functionality
      }
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
    const result = await context.translationService.translateToMultipleLanguages({
      text: message.text,
      sourceLanguage: teacherLanguage,
      targetLanguages: studentLanguages,
      startTime,
      latencyTracking
    });
    
    // Convert result format to match expected type
    const translations: Record<string, string> = {};
    const translationResults: Record<string, { 
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    }> = {};
    
    result.translations.forEach((translation: string, language: string) => {
      translations[language] = translation;
    });
    
    result.translationResults.forEach(({ language, translation }: { language: string; translation: string }) => {
      translationResults[language] = {
        originalText: message.text,
        translatedText: translation,
        audioBuffer: Buffer.from('') // Empty buffer for now
      };
    });
    
    const latencyInfo = result.latencyInfo;
    
    // Update latency tracking with the results
    Object.assign(latencyTracking.components, latencyInfo);
    
    // Calculate processing latency before sending translations
    const processingEndTime = Date.now();
    latencyTracking.components.processing = processingEndTime - startTime - latencyTracking.components.translation;
    
    // Send translations to students
    context.translationService.sendTranslationsToStudents({
      studentConnections,
      originalText: message.text,
      sourceLanguage: teacherLanguage,
      translations: result.translations,
      translationResults: result.translationResults,
      startTime,
      latencyTracking,
      getClientSettings: (ws: WebSocketClient) => context.connectionManager.getClientSettings(ws),
      getLanguage: (ws: WebSocketClient) => context.connectionManager.getLanguage(ws),
      getSessionId: (ws: WebSocketClient) => context.connectionManager.getSessionId(ws),
      storage: context.storage
    });
  }
}
