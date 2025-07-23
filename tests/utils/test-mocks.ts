/**
 * Test Mocking Utilities
 * 
 * This file provides mocking utilities for integration tests
 * to avoid external service dependencies like OpenAI.
 */

import { vi } from 'vitest';

/**
 * Creates a mock translation service that returns instant translations
 * without requiring external API calls
 */
export function createMockTranslationService() {
  return {
    translateToMultipleLanguages: vi.fn().mockImplementation(async ({ 
      text, 
      sourceLanguage, 
      targetLanguages, 
      startTime,
      latencyTracking 
    }) => {
      console.log('🎯 Mock translateToMultipleLanguages called with:', {
        text: text.substring(0, 50),
        sourceLanguage,
        targetLanguagesCount: targetLanguages.length,
        targetLanguages
      });
      
      // Create a simple translation map
      const translations = new Map<string, string>();
      const translationResults = targetLanguages.map((language: string) => {
        // Create a fake translation by adding language prefix
        const translation = `[${language}] ${text}`;
        translations.set(language, translation);
        return { 
          language, 
          translation,
          originalText: text
        };
      });

      // Add some mock latency tracking data
      const latencyInfo = {
        preparation: 5,
        translation: 20,
        tts: 10,
        processing: 5
      };

      // Update the provided latencyTracking object to match mock values
      if (latencyTracking && latencyTracking.components) {
        latencyTracking.components.preparation = latencyInfo.preparation;
        latencyTracking.components.translation = latencyInfo.translation;
        latencyTracking.components.tts = latencyInfo.tts;
        latencyTracking.components.processing = latencyInfo.processing;
      }

      console.log('🎯 Mock translateToMultipleLanguages returning:', {
        translationsCount: translations.size,
        translationResultsCount: translationResults.length
      });

      return {
        translations,
        translationResults,
        latencyInfo
      };
    }),
    
    sendTranslationsToStudents: vi.fn().mockImplementation((options) => {
      console.log('🎯 Mock sendTranslationsToStudents called with:', {
        originalText: options.originalText?.substring(0, 50) || 'N/A',
        sourceLanguage: options.sourceLanguage,
        translationsCount: options.translations?.size || 0
      });

      const { 
        studentConnections, 
        translations,
        originalText,
        sourceLanguage,
        getLanguage,
        getSessionId,
        getClientSettings,
        storage,
        startTime,
        latencyTracking
      } = options;

      // Calculate total latency for the mock
      const serverCompleteTime = Date.now();
      const totalLatency = serverCompleteTime - startTime;

      // Send translations directly to each student connection
      studentConnections.forEach((ws: any) => {
        const studentLanguage = getLanguage(ws);
        const clientSettings = getClientSettings?.(ws) || {};
        
        if (!studentLanguage) {
          console.log('🎯 Mock: Student has no language set');
          return;
        }
        
        const sessionId = getSessionId?.(ws) || 'unknown';
        const translation = translations.get(studentLanguage) || originalText;

        // Create translation message with all required fields
        const translationMessage = {
          type: 'translation',
          text: translation,
          originalText,
          sourceLanguage,
          targetLanguage: studentLanguage,
          ttsServiceType: clientSettings.ttsServiceType || 'openai',
          audioData: '', // No audio in mocks
          useClientSpeech: clientSettings.useClientSpeech === true,
          latency: {
            total: totalLatency,
            serverCompleteTime: serverCompleteTime,
            components: latencyTracking?.components || {
              preparation: 5,
              translation: 20,
              tts: 10,
              processing: 5
            }
          }
        };
        
        // Send a mock translation message directly
        console.log('🎯 Mock: Sending translation message to student', {
          studentLanguage,
          messageType: translationMessage.type,
          hasText: !!translationMessage.text
        });
        
        ws.send(JSON.stringify(translationMessage));
        
        // Log what we're sending for debugging
        console.log(`🎯 Mock: Sent translation to ${studentLanguage}`, {
          sessionId,
          sourceLanguage,
          targetLanguage: studentLanguage,
          hasClientSettings: !!clientSettings
        });

        // Mock the database storage call if storage is provided
        if (storage && process.env.ENABLE_DETAILED_TRANSLATION_LOGGING === 'true') {
          // Explicitly use setTimeout to simulate async behavior but not block the current function
          setTimeout(async () => {
            try {
              console.log('🎯 Mock: Storing translation in database');
              await storage.addTranslation({
                sessionId,
                sourceLanguage,
                targetLanguage: studentLanguage,
                originalText,
                translatedText: translation,
                latency: latencyTracking?.components?.translation || 20
              });
              console.log('🎯 Mock: Translation stored successfully');
            } catch (error) {
              console.error('🎯 Mock: Error storing translation', error);
            }
          }, 0);
        }
      });
      
      console.log('🎯 Mock sendTranslationsToStudents completed');
    }),

    // Mock the TTS function to avoid real API calls
    generateTTSAudio: vi.fn().mockImplementation(async (
      text: string,
      languageCode: string,
      ttsServiceType: string = 'openai',
      voice?: string
    ) => {
      console.log('Mock: Generating TTS audio (mocked)', { 
        textLength: text.length, 
        languageCode, 
        ttsServiceType 
      });
      
      // Return an empty buffer as mock audio
      return Buffer.from('');
    }),
    
    // Mock any other methods that might be called
    validateTTSRequest: vi.fn().mockImplementation((text: string, languageCode: string) => {
      return true; // Always validate in mock
    })
  };
}

/**
 * Creates a mock OpenAI service for testing
 */
export function mockOpenAIService() {
  return {
    translateSpeech: vi.fn().mockImplementation(async (audioBuffer, sourceLanguage, targetLanguage) => {
      return {
        originalText: 'This is a mock transcription',
        translatedText: `Translated to ${targetLanguage}`,
        audioBuffer
      };
    }),
    
    transcribeSpeech: vi.fn().mockImplementation(async (audioBuffer, languageHint) => {
      return 'This is a mock transcription';
    })
  };
}
