/**
 * Unit tests for TranslationOrchestrator
 */

import { TranslationOrchestrator } from '../../../../server/services/websocket/TranslationOrchestrator';
import { speechTranslationService } from '../../../../server/services/TranslationService';
import { vi, describe, it, beforeEach, expect } from 'vitest';

// Mock the TranslationService dependency
vi.mock('../../../../server/services/TranslationService', () => ({
  speechTranslationService: {
    translateSpeech: vi.fn(),
    translateText: vi.fn(),
    generateTTSAudio: vi.fn()
  }
}));

describe('TranslationOrchestrator', () => {
  let translationOrchestrator: TranslationOrchestrator;
  let mockSpeechTranslationService: any;

  beforeEach(() => {
    translationOrchestrator = new TranslationOrchestrator();
    
    // Get the mocked service
    mockSpeechTranslationService = speechTranslationService;
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('translateToMultipleLanguages', () => {
    it('should translate text to multiple languages successfully', async () => {
      // Arrange
      mockSpeechTranslationService.translateSpeech
        .mockResolvedValueOnce({ 
          originalText: 'Hello',
          translatedText: 'Hola',
          audioBuffer: Buffer.from('fake-audio-es')
        })
        .mockResolvedValueOnce({ 
          originalText: 'Hello',
          translatedText: 'Bonjour',
          audioBuffer: Buffer.from('fake-audio-fr')
        });

      const request = {
        text: 'Hello',
        sourceLanguage: 'en-US',
        targetLanguages: ['es-ES', 'fr-FR'],
        startTime: Date.now(),
        latencyTracking: {
          start: Date.now(),
          components: {
            preparation: 0,
            translation: 0,
            tts: 0,
            processing: 0
          }
        }
      };

      // Act
      const result = await translationOrchestrator.translateToMultipleLanguages(request);

      // Assert
      expect(result.translations.get('es-ES')).toBe('Hola');
      expect(result.translations.get('fr-FR')).toBe('Bonjour');
      expect(result.translationResults).toHaveLength(2);
      expect(result.translationResults[0]).toEqual({ language: 'es-ES', translation: 'Hola' });
      expect(result.translationResults[1]).toEqual({ language: 'fr-FR', translation: 'Bonjour' });
      expect(mockSpeechTranslationService.translateSpeech).toHaveBeenCalledTimes(2);
    });

    it('should handle translation errors gracefully', async () => {
      // Arrange
      mockSpeechTranslationService.translateSpeech
        .mockRejectedValueOnce(new Error('Translation failed'))
        .mockResolvedValueOnce({ 
          originalText: 'Hello',
          translatedText: 'Bonjour',
          audioBuffer: Buffer.from('fake-audio-fr')
        });

      const request = {
        text: 'Hello',
        sourceLanguage: 'en-US',
        targetLanguages: ['es-ES', 'fr-FR'],
        startTime: Date.now(),
        latencyTracking: {
          start: Date.now(),
          components: {
            preparation: 0,
            translation: 0,
            tts: 0,
            processing: 0
          }
        }
      };

      // Act
      const result = await translationOrchestrator.translateToMultipleLanguages(request);

      // Assert
      // Should fallback to original text for failed translation
      expect(result.translations.get('es-ES')).toBe('Hello');
      expect(result.translations.get('fr-FR')).toBe('Bonjour');
      expect(result.translationResults).toHaveLength(2);
      expect(result.translationResults[0]).toEqual({ language: 'es-ES', translation: 'Hello' });
      expect(result.translationResults[1]).toEqual({ language: 'fr-FR', translation: 'Bonjour' });
    });
  });

  describe('validateTTSRequest', () => {
    it('should validate valid TTS request', () => {
      // Act & Assert
      expect(translationOrchestrator.validateTTSRequest('Hello world', 'en-US')).toBe(true);
    });

    it('should reject empty text', () => {
      // Act & Assert
      expect(translationOrchestrator.validateTTSRequest('', 'en-US')).toBe(false);
      expect(translationOrchestrator.validateTTSRequest('   ', 'en-US')).toBe(false);
      expect(translationOrchestrator.validateTTSRequest(null as any, 'en-US')).toBe(false);
      expect(translationOrchestrator.validateTTSRequest(undefined as any, 'en-US')).toBe(false);
    });

    it('should reject invalid language code', () => {
      // Act & Assert
      expect(translationOrchestrator.validateTTSRequest('Hello', '')).toBe(false);
      expect(translationOrchestrator.validateTTSRequest('Hello', null as any)).toBe(false);
      expect(translationOrchestrator.validateTTSRequest('Hello', undefined as any)).toBe(false);
    });
  });
});
