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
import { FeatureFlags } from '../../application/services/config/FeatureFlags';
import { ACEOrchestrator } from '../../application/services/ace/ACEOrchestrator';
import type { WebSocketClient } from '../../interface-adapters/websocket/websocket-services/ConnectionManager';

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
      text: (text || '').substring(0, 100), 
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

    // Optional: synthesize original-source audio once (teacherLanguage) only when explicitly enabled to avoid espeak aborts in tests
    const includeOriginalAudio = (process.env.FEATURE_INCLUDE_ORIGINAL_TTS || '0') === '1';
    let originalAudioBase64: string | null = null;
    let originalAudioFormat: 'mp3' | 'wav' | undefined;
    if (includeOriginalAudio) {
      try {
        const originalTTS = await this.speechPipelineOrchestrator.synthesizeSpeech(
          text,
          teacherLanguage
        );
        originalAudioBase64 = originalTTS.audioBuffer.toString('base64');
        originalAudioFormat = originalTTS.ttsServiceType === 'local' ? 'wav' : 'mp3';
      } catch (e) {
        originalAudioBase64 = null;
      }
    }

    // Prepare ACE orchestrator if enabled
    const aceEnabled = FeatureFlags.ACE;
    const ace = aceEnabled ? new ACEOrchestrator({}) : null;

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

          // Apply ACE shaping per-student (term-locking, simplification)
          // Note: term-locking applied within ACE orchestrator; per-student lowLiteracyMode respected
          const shapedByStudent: Array<{ ws: WebSocketClient; text: string }> = [];
          for (const student of students) {
            const settings = options.clientProvider.getClientSettings(student) || {};
            const low = !!settings.lowLiteracyMode;
            const aceToggle = !!settings.aceEnabled;
            const useACE = FeatureFlags.ACE || aceToggle;
            const textForStudent = useACE && ace ? ace.applyPerStudentShaping(translation, { lowLiteracyMode: low, languageCode: targetLanguage }) : translation;
            shapedByStudent.push({ ws: student, text: textForStudent });
          }

          // Generate TTS audio for the language group only when not using client speech
          // If lowLiteracyMode is common we still send audio; client pages decide to use speechParams
          const ttsResult = await this.speechPipelineOrchestrator.synthesizeSpeech(
            translation,
            targetLanguage
          );

          // Send translation and audio to students in this language group
          for (const student of students) {
            try {
              const shaped = shapedByStudent.find(s => s.ws === student)?.text || translation;

              // Determine per-student audio delivery: for low-literacy, instruct browser TTS; otherwise send server audio
              const studentSettings = options.clientProvider.getClientSettings(student) || {};
              const lowLiteracy = FeatureFlags.LOW_LITERACY_MODE && (studentSettings.lowLiteracyMode === true);
              let audioDataBase64: string;
              let audioFormat: 'mp3' | 'wav' | undefined = ttsResult.ttsServiceType === 'local' ? 'wav' : 'mp3';
              if (lowLiteracy) {
                const browserSpeech = {
                  type: 'browser-speech',
                  text: shaped,
                  languageCode: targetLanguage,
                  autoPlay: true
                };
                audioDataBase64 = Buffer.from(JSON.stringify(browserSpeech)).toString('base64');
                // audioFormat remains 'mp3' nominally; client ignores for browser-speech
              } else {
                audioDataBase64 = ttsResult.audioBuffer.toString('base64');
              }

              const message = {
                type: 'translation',
                originalText: text,  // Add original text
                text: shaped,
                translatedText: shaped,
                audioData: audioDataBase64,
                audioFormat: audioFormat,
                // Feature: include original-source audio in teacher's language when enabled
                ...(originalAudioBase64 ? {
                  originalAudioData: originalAudioBase64,
                  originalAudioFormat: originalAudioFormat || 'mp3'
                } : {}),
                sourceLanguage: teacherLanguage,
                targetLanguage: targetLanguage,
                timestamp: Date.now(),
                ttsServiceType: ttsResult.ttsServiceType // Add the missing TTS service type
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
