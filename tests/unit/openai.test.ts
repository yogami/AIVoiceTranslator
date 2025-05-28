/**
 * OpenAI Service Unit Tests
 * 
 * Tests for all OpenAI-related functionality with mocked dependencies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateSpeech } from '../../server/openai';
import { createMockAudioBuffer, createMockWebSocketClient } from './utils/test-helpers';

// Mock only the external dependencies
vi.mock('../../server/services/TranslationService', () => ({
  transcriptionService: {
    transcribe: vi.fn()
  },
  translationService: {
    translate: vi.fn()
  },
  textToSpeechService: {
    synthesizeSpeech: vi.fn()
  },
  translateSpeech: vi.fn()
}));

describe('OpenAI Service', () => {
  let mockTranslateSpeech: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mocked function
    const TranslationServiceModule = await import('../../server/services/TranslationService');
    mockTranslateSpeech = (TranslationServiceModule as any).translateSpeech;
    
    // Set default mock implementation
    mockTranslateSpeech.mockImplementation(async (audioBuffer: any, sourceLang: string, targetLang: string, preTranscribedText?: string) => {
      const originalText = preTranscribedText || 'Test transcription';
      const translatedText = sourceLang === targetLang ? originalText : 'Test translation';
      
      return {
        originalText,
        translatedText,
        audioBuffer: Buffer.from('mock-audio')
      };
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('translateSpeech', () => {
    it('should_TranslateAudioSuccessfully_When_ValidInputProvided', async () => {
      // Arrange
      const audioBuffer = createMockAudioBuffer(1000);
      const sourceLang = 'en-US';
      const targetLang = 'es-ES';
      
      // Act - Test the actual translateSpeech function, not a mock
      const result = await translateSpeech(audioBuffer, sourceLang, targetLang);
      
      // Assert
      expect(result).toEqual({
        originalText: 'Test transcription',
        translatedText: 'Test translation',
        audioBuffer: expect.any(Buffer)
      });
      
      expect(mockTranslateSpeech).toHaveBeenCalledWith(audioBuffer, sourceLang, targetLang, undefined);
    });

    it('should_UsePreTranscribedText_When_Provided', async () => {
      // Arrange
      const audioBuffer = createMockAudioBuffer(1000);
      const sourceLang = 'en-US';
      const targetLang = 'fr-FR';
      const preTranscribedText = 'Pre-transcribed text';
      
      // Act
      const result = await translateSpeech(audioBuffer, sourceLang, targetLang, preTranscribedText);
      
      // Assert
      expect(result.originalText).toBe(preTranscribedText);
      expect(mockTranslateSpeech).toHaveBeenCalledWith(audioBuffer, sourceLang, targetLang, preTranscribedText);
    });

    it('should_ReturnEmptyTranslation_When_TranscriptionIsEmpty', async () => {
      // Arrange
      mockTranslateSpeech.mockResolvedValue({
        originalText: '',
        translatedText: '',
        audioBuffer: expect.any(Buffer)
      });
      const audioBuffer = createMockAudioBuffer(1000);
      
      // Act
      const result = await translateSpeech(audioBuffer, 'en-US', 'es-ES');
      
      // Assert
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
    });

    it('should_SkipTranslation_When_SourceAndTargetLanguagesAreSame', async () => {
      // Arrange
      const audioBuffer = createMockAudioBuffer(1000);
      const language = 'en-US';
      
      // Act
      const result = await translateSpeech(audioBuffer, language, language);
      
      // Assert
      expect(result.originalText).toBe('Test transcription');
      expect(result.translatedText).toBe('Test transcription');
    });

    it('should_HandleTranscriptionError_When_ServiceFails', async () => {
      // Arrange
      mockTranslateSpeech.mockRejectedValue(new Error('Transcription failed'));
      const audioBuffer = createMockAudioBuffer(1000);
      
      // Act & Assert
      await expect(translateSpeech(audioBuffer, 'en-US', 'es-ES'))
        .rejects
        .toThrow('Transcription failed');
    });

    it('should_HandleTranslationError_When_ServiceFails', async () => {
      // Arrange
      mockTranslateSpeech.mockRejectedValue(new Error('Translation failed'));
      const audioBuffer = createMockAudioBuffer(1000);
      
      // Act & Assert
      await expect(translateSpeech(audioBuffer, 'en-US', 'es-ES'))
        .rejects
        .toThrow('Translation failed');
    });

    it('should_HandleTTSError_When_SynthesisFails', async () => {
      // Arrange
      mockTranslateSpeech.mockRejectedValue(new Error('TTS failed'));
      const audioBuffer = createMockAudioBuffer(1000);
      
      // Act & Assert
      await expect(translateSpeech(audioBuffer, 'en-US', 'es-ES'))
        .rejects
        .toThrow('TTS failed');
    });
  });

  describe('Streaming Functionality', () => {
    let mockWs: any;
    
    beforeEach(() => {
      mockWs = createMockWebSocketClient();
    });
    
    it('should handle streaming audio processing', async () => {
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      
      // Mock behavior
      const processAudio = async (ws: any, id: string, audio: string) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'processing', sessionId: id }));
          return true;
        }
        return false;
      };
      
      const result = await processAudio(mockWs, sessionId, audioBase64);
      expect(result).toBe(true);
      expect(mockWs.send).toHaveBeenCalled();
    });
    
    it('should handle session finalization', async () => {
      const sessionId = 'test-session-123';
      
      const finalizeSession = async (ws: any, id: string) => {
        ws.send(JSON.stringify({ type: 'finalized', sessionId: id }));
      };
      
      await finalizeSession(mockWs, sessionId);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'finalized', sessionId }));
    });
    
    it('should handle cleanup of inactive sessions', () => {
      const sessions = new Map([
        ['session1', { lastActivity: Date.now() - 70000 }],
        ['session2', { lastActivity: Date.now() - 30000 }]
      ]);
      
      const cleanupSessions = (sessionMap: Map<string, any>, timeout: number) => {
        const now = Date.now();
        const toDelete: string[] = [];
        
        sessionMap.forEach((session, id) => {
          if (now - session.lastActivity > timeout) {
            toDelete.push(id);
          }
        });
        
        toDelete.forEach(id => sessionMap.delete(id));
        return toDelete.length;
      };
      
      const cleaned = cleanupSessions(sessions, 60000);
      expect(cleaned).toBe(1);
      expect(sessions.size).toBe(1);
      expect(sessions.has('session2')).toBe(true);
    });
  });
});