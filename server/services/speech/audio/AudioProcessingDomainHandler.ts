/**
 * Audio Processing Domain Handler
 * 
 * Clean Architecture Domain Layer Handler for Audio Processing
 * 
 * This handler contains the business logic for processing audio data.
 * It delegates to the SpeechPipelineOrchestrator for actual audio processing.
 * 
 * Clean Architecture Principles:
 * - Contains audio processing business logic and validation
 * - Delegates to SpeechPipelineOrchestrator for audio processing
 * - Independent of transport layer (WebSocket) concerns
 * - Can be tested independently
 */

import type { AudioMessageToServer } from '../../WebSocketTypes';
import logger from '../../../logger';
import { config } from '../../../config';

export interface IAudioProcessingDomainHandler {
  handle(message: AudioMessageToServer, sessionId: string, role: string): Promise<void>;
}

export class AudioProcessingDomainHandler implements IAudioProcessingDomainHandler {
  constructor(
    private speechPipelineOrchestrator: any // SpeechPipelineOrchestrator
  ) {}

  async handle(message: AudioMessageToServer, sessionId: string, role: string): Promise<void> {
    try {
      // Only process audio from teacher
      if (role !== 'teacher') {
        logger.info('Ignoring audio from non-teacher role:', { role, sessionId });
        return;
      }
      
      // Process audio data
      if (message.data) {
        await this.processTeacherAudio(sessionId, message.data);
      }
    } catch (error) {
      logger.error('Error processing teacher audio:', { error, sessionId });
    }
  }

  /**
   * Process audio from teacher using domain orchestrator
   */
  private async processTeacherAudio(sessionId: string, audioData: string): Promise<void> {
    // Validate audio data
    if (!audioData || audioData.length < config.session.minAudioDataLength) {
      logger.debug('Audio data too short, skipping processing', { sessionId });
      return;
    }
    
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      if (audioBuffer.length < config.session.minAudioBufferLength) {
        logger.debug('Audio buffer too small, skipping processing', { sessionId });
        return;
      }
      
      // Delegate to SpeechPipelineOrchestrator for audio processing
      await this.speechPipelineOrchestrator.processAudioData(
        sessionId,
        audioBuffer
      );
      
      logger.debug('Audio processing delegated to orchestrator', { sessionId });
    } catch (error) {
      logger.error('Error processing teacher audio data:', { error, sessionId });
    }
  }
}
