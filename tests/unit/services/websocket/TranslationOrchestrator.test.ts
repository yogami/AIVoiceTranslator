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

  describe('sendTranslationsToStudents', () => {
    let mockStudentWs: any;
    let mockGetLanguage: any;
    let mockGetClientSettings: any;
    let mockGetSessionId: any;
    let mockStorage: any;

    beforeEach(() => {
      mockStudentWs = {
        send: vi.fn()
      };
      
      mockGetLanguage = vi.fn();
      mockGetClientSettings = vi.fn().mockReturnValue({});
      mockGetSessionId = vi.fn().mockReturnValue('test-session-id');
      mockStorage = {
        addTranslation: vi.fn()
      };
    });

    it('should skip students with no language set', () => {
      // Arrange
      mockGetLanguage.mockReturnValue(undefined);
      
      const options = {
        studentConnections: [mockStudentWs],
        originalText: 'Hello',
        sourceLanguage: 'en-US',
        translations: new Map([['es-ES', 'Hola']]),
        translationResults: [{ language: 'es-ES', translation: 'Hola' }],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
        getClientSettings: mockGetClientSettings,
        getLanguage: mockGetLanguage,
        getSessionId: mockGetSessionId,
        storage: mockStorage
      };

      // Act
      translationOrchestrator.sendTranslationsToStudents(options);

      // Assert
      expect(mockStudentWs.send).not.toHaveBeenCalled();
      expect(mockStorage.addTranslation).not.toHaveBeenCalled();
    });

    it('should skip students with empty language code', () => {
      // Arrange
      mockGetLanguage.mockReturnValue('');
      
      const options = {
        studentConnections: [mockStudentWs],
        originalText: 'Hello',
        sourceLanguage: 'en-US',
        translations: new Map([['es-ES', 'Hola']]),
        translationResults: [{ language: 'es-ES', translation: 'Hola' }],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
        getClientSettings: mockGetClientSettings,
        getLanguage: mockGetLanguage,
        getSessionId: mockGetSessionId,
        storage: mockStorage
      };

      // Act
      translationOrchestrator.sendTranslationsToStudents(options);

      // Assert
      expect(mockStudentWs.send).not.toHaveBeenCalled();
      expect(mockStorage.addTranslation).not.toHaveBeenCalled();
    });

    it('should skip students with whitespace-only language code', () => {
      // Arrange
      mockGetLanguage.mockReturnValue('   ');
      
      const options = {
        studentConnections: [mockStudentWs],
        originalText: 'Hello',
        sourceLanguage: 'en-US',
        translations: new Map([['es-ES', 'Hola']]),
        translationResults: [{ language: 'es-ES', translation: 'Hola' }],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
        getClientSettings: mockGetClientSettings,
        getLanguage: mockGetLanguage,
        getSessionId: mockGetSessionId,
        storage: mockStorage
      };

      // Act
      translationOrchestrator.sendTranslationsToStudents(options);

      // Assert
      expect(mockStudentWs.send).not.toHaveBeenCalled();
      expect(mockStorage.addTranslation).not.toHaveBeenCalled();
    });

    it('should skip storing translation with invalid source language', async () => {
      // Arrange
      process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
      mockGetLanguage.mockReturnValue('es-ES');
      
      const options = {
        studentConnections: [mockStudentWs],
        originalText: 'Hello',
        sourceLanguage: '', // Invalid source language
        translations: new Map([['es-ES', 'Hola']]),
        translationResults: [{ language: 'es-ES', translation: 'Hola' }],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
        getClientSettings: mockGetClientSettings,
        getLanguage: mockGetLanguage,
        getSessionId: mockGetSessionId,
        storage: mockStorage
      };

      // Act
      translationOrchestrator.sendTranslationsToStudents(options);
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Assert
      expect(mockStudentWs.send).toHaveBeenCalled(); // Translation should still be sent
      expect(mockStorage.addTranslation).not.toHaveBeenCalled(); // But not stored
      
      // Cleanup
      delete process.env.ENABLE_DETAILED_TRANSLATION_LOGGING;
    });

    it('should skip storing translation with invalid target language', () => {
      // Arrange
      process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
      mockGetLanguage.mockReturnValue(''); // Invalid student language
      
      const options = {
        studentConnections: [mockStudentWs],
        originalText: 'Hello',
        sourceLanguage: 'en-US',
        translations: new Map([['', 'Hola']]), // This won't be used since student language is invalid
        translationResults: [{ language: '', translation: 'Hola' }],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
        getClientSettings: mockGetClientSettings,
        getLanguage: mockGetLanguage,
        getSessionId: mockGetSessionId,
        storage: mockStorage
      };

      // Act
      translationOrchestrator.sendTranslationsToStudents(options);

      // Assert
      expect(mockStudentWs.send).not.toHaveBeenCalled(); // Translation should not be sent
      expect(mockStorage.addTranslation).not.toHaveBeenCalled(); // And not stored
      
      // Cleanup
      delete process.env.ENABLE_DETAILED_TRANSLATION_LOGGING;
    });

    it('should process valid student with proper language code', async () => {
      // Arrange
      mockGetLanguage.mockReturnValue('es-ES');
      
      const options = {
        studentConnections: [mockStudentWs],
        originalText: 'Hello',
        sourceLanguage: 'en-US',
        translations: new Map([['es-ES', 'Hola']]),
        translationResults: [{ language: 'es-ES', translation: 'Hola' }],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
        getClientSettings: mockGetClientSettings,
        getLanguage: mockGetLanguage,
        getSessionId: mockGetSessionId,
        storage: mockStorage
      };

      // Act
      translationOrchestrator.sendTranslationsToStudents(options);
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Assert
      expect(mockStudentWs.send).toHaveBeenCalled();
      // Storage depends on ENABLE_DETAILED_TRANSLATION_LOGGING environment variable
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
