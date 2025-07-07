import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { AudioMessageToServer } from '../WebSocketTypes';
import logger from '../../logger';
import { config } from '../../config';

export class AudioMessageHandler implements IMessageHandler<AudioMessageToServer> {
  getMessageType(): string {
    return 'audio';
  }

  async handle(message: AudioMessageToServer, context: MessageHandlerContext): Promise<void> {
    try {
      const role = context.connectionManager.getRole(context.ws);
      
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
      // Comment out server-side transcription since we're using client-side speech recognition
      // The client sends both audio chunks and transcriptions separately
      /*
      // Transcribe the audio
      const transcription = await audioTranscriptionService.transcribeAudio(
        audioBuffer,
        teacherLanguage
      );
      console.log('Transcribed audio:', transcription);
      // If we got a transcription, process it as a transcription message
      if (transcription && transcription.trim().length > 0) {
        await this.handleTranscriptionMessage(context.ws, {
          type: 'transcription',
          text: transcription,
          timestamp: Date.now(),
      if (transcription && transcriptions.trim().length > 0) {
        await this.handleTranscriptionMessage(context.ws, {
          type: 'transcription',
          text: transcription,
          timestamp: Date.now(),
          isFinal: true
        } as TranscriptionMessageToServer);
      }
      */
      // For now, just log that we received audio
      logger.debug('Received audio chunk from teacher, using client-side transcription');
    } catch (error) {
      logger.error('Error processing teacher audio:', { error });
    }
  }
}
