/**
 * Translation Orchestrator
 * 
 * Handles WebSocket-specific translation orchestration for real-time communication.
 * Manages the complete translation workflow including latency tracking and WebSocket broadcasting.
 * Uses the core TranslationService for actual translation logic.
 */
import logger from '../../logger';
import { config } from '../../config';
import { speechTranslationService } from '../TranslationService';
import type { WebSocketClient } from './ConnectionManager';
import type { 
  TranslationMessageToClient,
  ClientSettings
} from '../WebSocketTypes';

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguages: string[];
  startTime: number;
  latencyTracking: LatencyTracking;
}

export interface LatencyTracking {
  start: number;
  components: {
    preparation: number;
    translation: number;
    tts: number;
    processing: number;
  };
}

export interface TranslationResult {
  translations: Map<string, string>;
  translationResults: { language: string; translation: string }[];
  latencyInfo: {
    preparation: number;
    translation: number;
    tts: number;
    processing: number;
  };
}

export interface SendTranslationOptions {
  studentConnections: WebSocketClient[];
  originalText: string;
  sourceLanguage: string;
  translations: Map<string, string>;
  translationResults: { language: string; translation: string }[];
  startTime: number;
  latencyTracking: LatencyTracking;
  getClientSettings: (ws: WebSocketClient) => ClientSettings | undefined;
  getLanguage: (ws: WebSocketClient) => string | undefined;
  getSessionId?: (ws: WebSocketClient) => string | undefined; // Add session ID getter
  // storage?: any; // Removed unused property to fix lint error
}
export class TranslationOrchestrator {
  private storage: any; // IStorage - using any to avoid circular dependency

  constructor(storage?: any) {
    this.storage = storage;
  }

  /**
   * Translate text to multiple target languages
   */
  async translateToMultipleLanguages(request: TranslationRequest): Promise<TranslationResult> {
    const { text, sourceLanguage, targetLanguages, startTime, latencyTracking } = request;
    logger.info('Translating to multiple languages:', {
      text,
      sourceLanguage,
      targetLanguages,
      targetLanguageCount: targetLanguages.length
    });

    // Record preparation time
    const preparationEndTime = Date.now();
    latencyTracking.components.preparation = preparationEndTime - startTime;

    const translations = new Map<string, string>();
    const translationResults: { language: string; translation: string }[] = [];

    // Start translation timing
    const translationStartTime = Date.now();

    const translationPromises = targetLanguages.map(async (targetLanguage) => {
      try {
        const result = await speechTranslationService.translateSpeech(
          Buffer.from(''), // Empty buffer since we have text
          sourceLanguage,
          targetLanguage,
          text, // Use the provided text directly
          { ttsServiceType: 'openai' } // Always use OpenAI TTS for best quality
        );
        const translation = result.translatedText;
        translations.set(targetLanguage, translation);
        translationResults.push({ language: targetLanguage, translation });
        logger.info('Translation completed:', {
          sourceLanguage,
          targetLanguage,
          originalText: text,
          translatedText: translation
        });
        return { targetLanguage, translation };
      } catch (error) {
        logger.error(`Translation failed for ${targetLanguage}:`, { error });
        // Use original text as fallback
        translations.set(targetLanguage, text);
        translationResults.push({ language: targetLanguage, translation: text });
        return { targetLanguage, translation: text };
      }
    });

    await Promise.all(translationPromises);

    // Record translation time
    const translationEndTime = Date.now();
    latencyTracking.components.translation = translationEndTime - translationStartTime;

    logger.info('All translations completed:', {
      translationCount: translations.size,
      translationTime: latencyTracking.components.translation
    });

    return {
      translations,
      translationResults,
      latencyInfo: latencyTracking.components
    };
  }

  /**
   * Send translations to all student connections, returns a Promise that resolves when all sends are complete
   */
  async sendTranslationsToStudents(options: SendTranslationOptions): Promise<void> {
    const {
      studentConnections,
      originalText,
      sourceLanguage,
      translations,
      startTime,
      latencyTracking,
      getClientSettings,
      getLanguage,
      getSessionId
    } = options;
    const storage = this.storage;

    logger.info('WebSocketServer: sendTranslationsToStudents started');

    // Start TTS timing
    const ttsStartTime = Date.now();

    // Track delivery status for each student
    const deliveryResults: { studentWs: WebSocketClient; studentLanguage: string; delivered: boolean; error?: unknown; }[] = [];

    // Helper to send translation with retry (arrow function preserves 'this' context)
    const sendWithRetry = async (studentWs: WebSocketClient, studentLanguage: string, attempt: number = 1): Promise<boolean> => {
      try {
        const clientSettings = getClientSettings(studentWs) || {};
        const translation = translations.get(studentLanguage) || originalText;
        const ttsServiceType = clientSettings.ttsServiceType || 'openai';
        const useClientSpeech = clientSettings.useClientSpeech === true;
        let audioData = '';
        let speechParams: { type: 'browser-speech'; text: string; languageCode: string; autoPlay: boolean; } | undefined;
        if (useClientSpeech) {
          speechParams = {
            type: 'browser-speech',
            text: translation,
            languageCode: studentLanguage,
            autoPlay: true
          };
        } else {
          try {
            const audioBuffer = await this.generateTTSAudio(
              translation,
              studentLanguage,
              ttsServiceType
            );
            audioData = audioBuffer ? audioBuffer.toString('base64') : '';
          } catch (error) {
            logger.error('Error generating TTS audio:', { error });
            audioData = '';
          }
        }
        const ttsEndTime = Date.now();
        if (latencyTracking.components.tts === 0) {
          latencyTracking.components.tts = ttsEndTime - ttsStartTime;
        }
        const serverCompleteTime = Date.now();
        const totalLatency = serverCompleteTime - startTime;
        const translationMessage: TranslationMessageToClient = {
          type: 'translation',
          text: translation,
          originalText: originalText,
          sourceLanguage: sourceLanguage,
          targetLanguage: studentLanguage,
          ttsServiceType: ttsServiceType,
          latency: {
            total: totalLatency,
            serverCompleteTime: serverCompleteTime,
            components: latencyTracking.components
          },
          audioData: audioData,
          useClientSpeech: useClientSpeech,
          ...(speechParams && { speechParams })
        };
        studentWs.send(JSON.stringify(translationMessage));
        logger.info('Sent translation to student:', {
          studentLanguage,
          translation,
          originalText,
          ttsServiceType,
          useClientSpeech,
          totalLatency,
          hasAudio: audioData.length > 0,
          attempt
        });
        return true;
      } catch (error) {
        logger.error('Error sending translation to student:', { error, studentLanguage, attempt });
        if (attempt < 3) {
          logger.warn(`Retrying translation delivery for ${studentLanguage}, attempt ${attempt + 1}`);
          return await sendWithRetry(studentWs, studentLanguage, attempt + 1);
        }
        return false;
      }
    };

    // Send translations to each student, with delivery tracking and retry
    const translationPromises = studentConnections.map(async (studentWs: WebSocketClient) => {
      const studentLanguage = getLanguage(studentWs);
      if (!studentLanguage || typeof studentLanguage !== 'string' || studentLanguage.trim().length === 0) {
        logger.warn('Student has no valid language set, skipping translation', {
          sessionId: getSessionId ? getSessionId(studentWs) : 'unknown',
          studentLanguage
        });
        deliveryResults.push({ studentWs, studentLanguage: studentLanguage || '', delivered: false, error: 'Invalid language' });
        return;
      }
      const delivered = await sendWithRetry(studentWs, studentLanguage, 1);
      deliveryResults.push({ studentWs, studentLanguage, delivered });
      // Persist translation for diagnostics and product usage, if enabled
      if (delivered && storage) {
        const enableDetailedTranslationLogging = process.env.ENABLE_DETAILED_TRANSLATION_LOGGING === 'true';
        if (enableDetailedTranslationLogging) {
          const classroomSessionId = getSessionId?.(studentWs);
          const translationLatency = latencyTracking.components?.translation || 0;
          logger.info('WebSocketServer: About to persist translation', {
            classroomSessionId,
            translatedText: translations.get(studentLanguage) || originalText,
            translationLatency,
            originalText,
            sourceLanguage,
            targetLanguage: studentLanguage
          });
          if (classroomSessionId) {
            if (!sourceLanguage || typeof sourceLanguage !== 'string' || sourceLanguage.trim().length === 0) {
              logger.error('Invalid sourceLanguage, skipping translation storage', {
                sourceLanguage,
                classroomSessionId
              });
              return;
            }
            if (!studentLanguage || typeof studentLanguage !== 'string' || studentLanguage.trim().length === 0) {
              logger.error('Invalid targetLanguage (studentLanguage), skipping translation storage', {
                studentLanguage,
                classroomSessionId
              });
              return;
            }
            logger.info('WebSocketServer: Attempting to call storage.addTranslation (detailed logging enabled)');
            try {
              const translationData = {
                sessionId: classroomSessionId,
                sourceLanguage: sourceLanguage,
                targetLanguage: studentLanguage,
                originalText: originalText,
                translatedText: translations.get(studentLanguage) || originalText,
                latency: translationLatency,
              };
              console.log('TranslationOrchestrator: About to call storage.addTranslation with data:', translationData);
              await storage.addTranslation(translationData);
              logger.info('WebSocketServer: storage.addTranslation finished successfully', { sessionId: classroomSessionId });
              console.log('TranslationOrchestrator: storage.addTranslation completed successfully');
            } catch (storageError) {
              logger.error('WebSocketServer: CRITICAL - Error calling storage.addTranslation. Database insertion failed!', {
                error: storageError,
                sessionId: classroomSessionId,
                errorMessage: storageError instanceof Error ? storageError.message : 'Unknown error',
                errorStack: storageError instanceof Error ? storageError.stack : undefined
              });
              console.error('CRITICAL DATABASE ERROR in addTranslation:', {
                error: storageError,
                message: storageError instanceof Error ? storageError.message : 'Unknown error',
                stack: storageError instanceof Error ? storageError.stack : undefined,
                sessionId: classroomSessionId
              });
              logger.error('=== TRANSLATION STORAGE FAILED ===');
              logger.error('This database error should be investigated:', storageError);
              logger.error('=== END STORAGE ERROR ===');
            }
          } else {
            logger.warn('WebSocketServer: Detailed translation logging enabled, but classroomSessionId not available, skipping storage.addTranslation', { hasSessionId: !!classroomSessionId });
          }
        } else {
          logger.info('WebSocketServer: Detailed translation logging is disabled via environment variable ENABLE_DETAILED_TRANSLATION_LOGGING, skipping storage.addTranslation');
        }
      }
      if (!delivered) {
        logger.error('CRITICAL: Translation delivery failed for student after 3 attempts', {
          studentLanguage,
          sessionId: getSessionId ? getSessionId(studentWs) : 'unknown'
        });
      }
    });

    logger.info('WebSocketServer: Awaiting all translation deliveries before session cleanup');
    await Promise.all(translationPromises);
    // Log summary of delivery results for teacher dashboard visibility
    const failedDeliveries = deliveryResults.filter(r => !r.delivered);
    if (failedDeliveries.length > 0) {
      logger.error('Summary: Some students did not receive translations after retries', {
        failedStudents: failedDeliveries.map(r => ({ studentLanguage: r.studentLanguage, error: r.error }))
      });
    } else {
      logger.info('Summary: All students received translations successfully');
    }
    logger.info('WebSocketServer: sendTranslationsToStudents finished (all translations sent, safe for cleanup)');
  }

  /**
   * Generate TTS audio for the given text
   */
  async generateTTSAudio(
    text: string,
    languageCode: string,
    ttsServiceType: string = 'openai',
    voice?: string
  ): Promise<Buffer> {
    const audioBuffer = await this.generateTTSAudioInternal(text, languageCode, ttsServiceType, voice);
    // Return the actual buffer or null - let the caller handle null properly
    return audioBuffer || Buffer.from('');
  }

  /**
   * Generate TTS audio for the given text (internal implementation)
   */
  private async generateTTSAudioInternal(
    text: string,
    languageCode: string,
    ttsServiceType: string,
    voice?: string
  ): Promise<Buffer | null> {
    if (!text || text.trim().length === 0) {
      logger.warn('Cannot generate TTS for empty text');
      return null;
    }

    try {
      logger.info('Generating TTS audio:', { 
        text: text.substring(0, config.session.logTextPreviewLength) + (text.length > config.session.logTextPreviewLength ? '...' : ''), 
        languageCode, 
        ttsServiceType, 
        voice 
      });

      // Use speechTranslationService for TTS to match test expectations
      const result = await speechTranslationService.translateSpeech(
        Buffer.from(''), // Empty buffer since we have text
        languageCode,   // Source language is the same as target for TTS-only
        languageCode,   // Target language
        text,           // Text to convert to speech
        { ttsServiceType } // Force specified TTS service type
      );

      if (!result.audioBuffer || result.audioBuffer.length === 0) {
        logger.warn('speechTranslationService returned empty audio buffer');
        return null;
      }

      logger.info('TTS audio generated successfully:', { 
        audioSize: result.audioBuffer.length,
        languageCode,
        ttsServiceType
      });

      return result.audioBuffer;
    } catch (error) {
      logger.error('Error generating TTS audio:', { 
        error, 
        text: text.substring(0, 50),
        languageCode,
        ttsServiceType 
      });
      return null;
    }
  }

  /**
   * Validate TTS request parameters
   */
  validateTTSRequest(text: string, languageCode: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      logger.error('Invalid TTS text:', { text });
      return false;
    }
    
    if (!languageCode || typeof languageCode !== 'string') {
      logger.error('Invalid TTS language code:', { languageCode });
      return false;
    }
    
    return true;
  }
}
