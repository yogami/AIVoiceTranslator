import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { AudioMessageToServer } from '../../../services/WebSocketTypes';
import { TranscriptionBusinessService } from '../../../services/transcription/TranscriptionBusinessService';
import logger from '../../../logger';
import { config } from '../../../config';

export class AudioMessageHandler implements IMessageHandler<AudioMessageToServer> {
  getMessageType(): string {
    return 'audio';
  }

  async handle(message: AudioMessageToServer, context: MessageHandlerContext): Promise<void> {
    // If client streams chunks, ignore non-final chunks to avoid log/API spam
    if (typeof (message as any).isFinalChunk !== 'undefined' && !(message as any).isFinalChunk) {
      return;
    }

    try {
      const role = context.connectionManager.getRole(context.ws);
      logger.debug(`[AudioMessageHandler] Role: ${role}`);
      
      // Only process audio from teacher
      if (role !== 'teacher') {
        logger.info('Ignoring audio from non-teacher role:', { role });
        return;
      }
    } catch (error) {
      logger.error('Error processing teacher audio:', { error });
      return;
    }
    
    // Process audio data
    if (message.data) {
      await this.processTeacherAudio(context, message.data);
    }
  }

  /**
   * Process audio from teacher
   */
  private async processTeacherAudio(context: MessageHandlerContext, audioData: string): Promise<void> {
    // Validate audio data
    if (!audioData || audioData.length < config.session.minAudioDataLength) {
      return;
    }
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      if (audioBuffer.length < config.session.minAudioBufferLength) {
        return;
      }
      const teacherLanguage = context.connectionManager.getLanguage(context.ws) || 'en-US';
      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) {
        logger.error('No session ID found for teacher');
        return;
      }
      // Process audio using TranscriptionBusinessService (same pattern as TranscriptionMessageHandler)
      logger.info(`[AudioMessageHandler] Processing audio from teacher in session ${sessionId}`);
      
      if (!context.speechPipelineOrchestrator) {
        logger.error('[AudioMessageHandler] SpeechPipelineOrchestrator not available in context');
        return;
      }
      
      const transcriptionService = new TranscriptionBusinessService(
        context.storage,
        context.speechPipelineOrchestrator
      );
      
      try {
        // First, transcribe the audio to get text
        const transcriptionResult = await context.speechPipelineOrchestrator.transcribeAudio(
          audioBuffer,
          teacherLanguage
        );
        
        if (!transcriptionResult || !transcriptionResult.trim()) {
          logger.warn('[AudioMessageHandler] No transcription result from audio');
          return;
        }
        
        logger.info(`[AudioMessageHandler] Audio transcribed: "${transcriptionResult.substring(0, 100)}..."`);
        
        // Now process the transcription through the business service
        // This will handle translation, TTS, and sending to students
        const sessionStudents = context.connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);
        const startTime = Date.now();
        const clientProvider = {
          getClientSettings: (ws: any) => context.connectionManager.getClientSettings(ws),
          getLanguage: (ws: any) => context.connectionManager.getLanguage(ws),
          getSessionId: (ws: any) => context.connectionManager.getSessionId(ws)
        };
        await transcriptionService.processTranscription({
          text: transcriptionResult,
          teacherLanguage,
          sessionId,
          studentConnections: sessionStudents.connections,
          studentLanguages: Array.from(sessionStudents.languages),
          startTime,
          latencyTracking: {
            start: startTime,
            components: {
              preparation: 0,
              translation: 0,
              tts: 0,
              processing: 0
            }
          }
        }, clientProvider);
        
        logger.info(`[AudioMessageHandler] Audio processing pipeline completed successfully`);
        
      } catch (error) {
        logger.error('[AudioMessageHandler] Audio processing failed:', error);
      }
    } catch (error) {
      logger.error('Error processing teacher audio:', { error });
    }
  }
}
