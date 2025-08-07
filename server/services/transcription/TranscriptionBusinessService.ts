/**
 * Business Service for Transcription Processing
 * 
 * Handles the business logic for processing transcriptions:
 * - Storing transcripts in database
 * - Coordinating translation and TTS pipeline
 * - Managing student delivery
 * 
 * This service is domain-specific and separate from WebSocket transport concerns.
 */
import logger from '../../logger';
import type { IStorage } from '../../storage.interface';
import type { SpeechPipelineOrchestrator } from '../SpeechPipelineOrchestrator';
import type { WebSocketClient } from '../websocket/ConnectionManager';

export interface TranscriptionProcessingRequest {
  text: string;
  teacherLanguage: string;
  sessionId: string;
  studentConnections: WebSocketClient[];
  studentLanguages: string[]; // Changed from Set<string> to string[]
  startTime: number;
  latencyTracking: {
    start: number;
    components: {
      preparation: number;
      translation: number;
      tts: number;
      processing: number;
    };
  };
}

export interface ClientSettingsProvider {
  getClientSettings(ws: WebSocketClient): any;
  getLanguage(ws: WebSocketClient): string | undefined;
  getSessionId(ws: WebSocketClient): string | undefined;
}

export class TranscriptionBusinessService {
  constructor(
    private storage: IStorage,
    private speechPipelineOrchestrator: SpeechPipelineOrchestrator
  ) {}

  /**
   * Process a transcription with full business logic
   */
  async processTranscription(
    request: TranscriptionProcessingRequest,
    clientProvider: ClientSettingsProvider
  ): Promise<void> {
    const { text, teacherLanguage, sessionId, studentConnections, studentLanguages, startTime, latencyTracking } = request;

    // Store the transcript in the database
    try {
      await this.storage.addTranscript({
        sessionId,
        language: teacherLanguage,
        text
      });
      logger.info('Transcript stored successfully', { sessionId, language: teacherLanguage });
    } catch (error) {
      logger.error('Failed to store transcript:', { error, sessionId });
      // Continue with translation - don't break core functionality
    }

    // Check if there are students to translate for
    if (studentConnections.length === 0) {
      logger.info('No students connected, skipping translation');
      return;
    }

    // Use the SpeechPipelineOrchestrator for translation and delivery
    try {
      await this.speechPipelineOrchestrator.sendTranslationsToStudents({
        studentConnections,
        originalText: text,
        sourceLanguage: teacherLanguage,
        targetLanguages: Array.from(new Set(studentLanguages)), // Convert to array and deduplicate
        startTime,
        latencyTracking,
        getClientSettings: clientProvider.getClientSettings,
        getLanguage: clientProvider.getLanguage,
        getSessionId: clientProvider.getSessionId
      });
    } catch (error) {
      logger.error('Error in transcription processing:', { 
        error, 
        errorMessage: error instanceof Error ? error.message : String(error), 
        errorStack: error instanceof Error ? error.stack : undefined 
      });
      throw error;
    }
  }

  /**
   * Validate if transcription should be processed
   */
  validateTranscriptionSource(role: string): { valid: boolean; reason?: string } {
    if (role !== 'teacher') {
      return { valid: false, reason: `Ignoring transcription from non-teacher role: ${role}` };
    }
    return { valid: true };
  }
}
