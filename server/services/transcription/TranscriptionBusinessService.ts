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
import type { SpeechPipelineOrchestrator } from '../../application/services/SpeechPipelineOrchestrator';
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
    const { 
      text, 
      teacherLanguage, 
      sessionId, 
      studentConnections, 
      studentLanguages, 
      startTime, 
      latencyTracking 
    } = request;

    logger.info('Processing transcription:', { 
      text: text.substring(0, 100), 
      teacherLanguage, 
      sessionId, 
      studentCount: studentConnections.length,
      targetLanguages: studentLanguages
    });

    // Early exit if no students are connected
    if (studentConnections.length === 0 || studentLanguages.length === 0) {
      logger.info('No students connected, skipping translation');
      return;
    }

    // Process translations for each target language
    try {
      await this.processTranslationsForStudents({
        text,
        teacherLanguage,
        sessionId,
        studentConnections,
        studentLanguages,
        startTime,
        latencyTracking,
        clientProvider
      });
    } catch (error) {
      logger.error('Error in transcription processing:', { 
        error, 
        errorMessage: error instanceof Error ? error.message : String(error), 
        sessionId,
        text: text.substring(0, 50)
      });
      throw error;
    }
  }

  /**
   * Process translations and deliver to students
   */
  private async processTranslationsForStudents(options: {
    text: string;
    teacherLanguage: string;
    sessionId: string;
    studentConnections: WebSocketClient[];
    studentLanguages: string[];
    startTime: number;
    latencyTracking: any;
    clientProvider: ClientSettingsProvider;
  }): Promise<void> {
    const { 
      text, 
      teacherLanguage, 
      sessionId, 
      studentConnections, 
      studentLanguages, 
      clientProvider 
    } = options;

    // Group students by their target language
    const studentsByLanguage = new Map<string, WebSocketClient[]>();
    
    for (const student of studentConnections) {
      const targetLang = clientProvider.getLanguage(student);
      if (targetLang && studentLanguages.includes(targetLang)) {
        if (!studentsByLanguage.has(targetLang)) {
          studentsByLanguage.set(targetLang, []);
        }
        studentsByLanguage.get(targetLang)!.push(student);
      }
    }

    // Process translation for each target language
    const translationPromises = Array.from(studentsByLanguage.entries()).map(
      async ([targetLanguage, students]) => {
        try {
          logger.info(`Processing translation for ${students.length} students in ${targetLanguage}`);
          
          // Use the orchestrator to translate text only
          const translation = await this.speechPipelineOrchestrator.translateText(
            text,
            teacherLanguage,
            targetLanguage
          );

          // Generate TTS audio
          const ttsResult = await this.speechPipelineOrchestrator.synthesizeSpeech(
            translation,
            targetLanguage
          );

          // Send translation and audio to students in this language group
          for (const student of students) {
            try {
              const message = {
                type: 'translation',
                originalText: text,  // Add original text
                text: translation,   // Keep translated text as 'text'
                translatedText: translation, // Also add as translatedText for compatibility
                audioData: ttsResult.audioBuffer.toString('base64'),
                sourceLanguage: teacherLanguage,
                targetLanguage: targetLanguage,
                timestamp: Date.now(),
                audioFormat: 'mp3' // Default format since TTSResult doesn't specify format
              };

              // Send the message via WebSocket
              if (student.readyState === 1) { // WebSocket.OPEN
                student.send(JSON.stringify(message));
                logger.debug(`Sent translation to student in ${targetLanguage}`);
              } else {
                logger.warn(`Student WebSocket not ready, skipping delivery`, { 
                  targetLanguage, 
                  readyState: student.readyState 
                });
              }
            } catch (error) {
              logger.error(`Failed to send translation to student`, { 
                error: error instanceof Error ? error.message : String(error),
                targetLanguage 
              });
            }
          }

          // Store translation in database if enabled
          try {
            if (process.env.ENABLE_DETAILED_TRANSLATION_LOGGING === 'true' && sessionId) {
              await this.storage.addTranslation({
                sessionId,
                originalText: text,
                translatedText: translation,
                sourceLanguage: teacherLanguage,
                targetLanguage: targetLanguage,
                timestamp: new Date()
              });
              logger.debug(`Stored translation in database for session ${sessionId}`);
            }
          } catch (storageError) {
            logger.warn(`Failed to store translation in database`, {
              error: storageError instanceof Error ? storageError.message : String(storageError),
              sessionId,
              targetLanguage
            });
          }

          logger.info(`Successfully processed translation for ${targetLanguage}`);
        } catch (error) {
          logger.error(`Failed to process translation for ${targetLanguage}:`, {
            error: error instanceof Error ? error.message : String(error),
            targetLanguage,
            studentCount: students.length
          });
          
          // Send fallback message to students (original text without translation)
          for (const student of students) {
            try {
              if (student.readyState === 1) {
                const fallbackMessage = {
                  type: 'translation',
                  originalText: text,  // Add original text
                  text: text, // Send original text as fallback
                  translatedText: text, // Also add as translatedText
                  sourceLanguage: teacherLanguage,
                  targetLanguage: targetLanguage,
                  timestamp: Date.now(),
                  error: 'Translation service unavailable'
                };
                student.send(JSON.stringify(fallbackMessage));
              }
            } catch (fallbackError) {
              logger.error(`Failed to send fallback message`, { 
                error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
              });
            }
          }
        }
      }
    );

    // Wait for all translations to complete
    await Promise.allSettled(translationPromises);
    
    logger.info(`Completed translation processing for ${studentsByLanguage.size} languages`);
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
