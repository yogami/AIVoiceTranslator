/**
 * Translation Orchestrator
 * 
 * Handles WebSocket-specific translation orchestration for real-time communication.
 * Manages the complete translation workflow including latency tracking and WebSocket broadcasting.
 * Uses the core TranslationService for actual translation logic.
 */
import logger from '../../logger';
import { speechTranslationService } from '../TranslationService';
import { textToSpeechService, ttsFactory } from '../textToSpeech/TextToSpeechService';
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
  storage?: any; // IStorage interface for detailed logging
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

    try {
      // Perform all translations in parallel
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
          
          logger.info(`Translation completed:`, { 
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
    } catch (error) {
      logger.error('Error in translateToMultipleLanguages:', { error });
      
      // Return fallback results
      targetLanguages.forEach(lang => {
        translations.set(lang, text);
        translationResults.push({ language: lang, translation: text });
      });

      return {
        translations,
        translationResults,
        latencyInfo: latencyTracking.components
      };
    }
  }

  /**
   * Send translations to all student connections
   */
  sendTranslationsToStudents(options: SendTranslationOptions): void {
    const {
      studentConnections,
      originalText,
      sourceLanguage,
      translations,
      translationResults,
      startTime,
      latencyTracking,
      getClientSettings,
      getLanguage,
      getSessionId,
      storage
    } = options;

    logger.info('WebSocketServer: sendTranslationsToStudents started');

    // Start TTS timing
    const ttsStartTime = Date.now();

    // Send translations to each student in their language
    studentConnections.forEach(async (studentWs) => {
      try {
        const studentLanguage = getLanguage(studentWs);
        const clientSettings = getClientSettings(studentWs) || {};
        
        if (!studentLanguage) {
          logger.warn('Student has no language set, skipping translation');
          return;
        }

        const translation = translations.get(studentLanguage) || originalText;
        
        // Use client-preferred TTS service type
        const ttsServiceType = clientSettings.ttsServiceType || 'openai';
        
        // Check if client wants to use browser speech synthesis
        const useClientSpeech = clientSettings.useClientSpeech === true;
        
        let audioData = '';
        let speechParams: { type: 'browser-speech'; text: string; languageCode: string; autoPlay: boolean; } | undefined;
        
        if (useClientSpeech) {
          // Send speech synthesis parameters for client-side TTS
          speechParams = {
            type: 'browser-speech',
            text: translation,
            languageCode: studentLanguage,
            autoPlay: true
          };
        } else {
          // Generate server-side TTS audio
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
        
        // Record TTS time (approximate, since we're doing this per student)
        const ttsEndTime = Date.now();
        if (latencyTracking.components.tts === 0) {
          latencyTracking.components.tts = ttsEndTime - ttsStartTime;
        }

        // Calculate total latency
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
        
        logger.info(`Sent translation to student:`, { 
          studentLanguage, 
          translation, 
          originalText,
          ttsServiceType,
          useClientSpeech,
          totalLatency,
          hasAudio: audioData.length > 0
        });

        // Persist translation for diagnostics and product usage, if enabled
        if (storage) {
          const enableDetailedTranslationLogging = process.env.ENABLE_DETAILED_TRANSLATION_LOGGING === 'true';

          if (enableDetailedTranslationLogging) {
            const classroomSessionId = getSessionId?.(studentWs);
            const translationLatency = latencyTracking.components?.translation || 0;

            logger.info('WebSocketServer: About to persist translation', {
              classroomSessionId,
              translatedText: translation,
              translationLatency,
              originalText,
              sourceLanguage,
              targetLanguage: studentLanguage
            });

            if (classroomSessionId) {
              logger.info('WebSocketServer: Attempting to call storage.addTranslation (detailed logging enabled)');
              (async () => {
                try {
                  await storage.addTranslation({
                    sessionId: classroomSessionId,
                    sourceLanguage: sourceLanguage,
                    targetLanguage: studentLanguage,
                    originalText: originalText,
                    translatedText: translation,
                    latency: translationLatency,
                  });
                  logger.info('WebSocketServer: storage.addTranslation finished successfully', { sessionId: classroomSessionId });
                } catch (storageError) {
                  logger.error('WebSocketServer: Error calling storage.addTranslation. This will not affect student-facing functionality.', { error: storageError, sessionId: classroomSessionId });
                }
              })();
            } else {
              logger.warn('WebSocketServer: Detailed translation logging enabled, but classroomSessionId not available, skipping storage.addTranslation', { hasSessionId: !!classroomSessionId });
            }
          } else {
            logger.info('WebSocketServer: Detailed translation logging is disabled via environment variable ENABLE_DETAILED_TRANSLATION_LOGGING, skipping storage.addTranslation');
          }
        }
      } catch (error) {
        logger.error('Error sending translation to student:', { error });
      }
    });

    logger.info('WebSocketServer: sendTranslationsToStudents finished');
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
      logger.info(`Generating TTS audio:`, { 
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
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
