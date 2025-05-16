/**
 * TranslationService Tests (Consolidated)
 * 
 * A comprehensive test suite for the TranslationService functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI implementation using inline mock functions
vi.mock('openai', () => {
  const mockTranscribe = vi.fn().mockResolvedValue({
    text: 'This is a test transcription'
  });
  
  const mockCompletion = vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: 'This is a translated test response'
        }
      }
    ]
  });
  
  // Expose the mocks so tests can access them
  vi.stubGlobal('mockTranslationTranscribe', mockTranscribe);
  vi.stubGlobal('mockTranslationCompletion', mockCompletion);
  
  return {
    default: class MockOpenAI {
      audio: any;
      chat: any;
      
      constructor() {
        this.audio = {
          transcriptions: {
            create: mockTranscribe
          }
        };
        this.chat = {
          completions: {
            create: mockCompletion
          }
        };
      }
    }
  };
});

// Mock Text-to-Speech service
vi.mock('../../../server/services/TextToSpeechService', () => ({
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio data'))
  }
}));

// Import the module under test
import { translateSpeech } from '../../../server/services/TranslationService';

describe('TranslationService', () => {
  let ttsServiceMock;
  
  beforeEach(() => {
    // Get references to the mocked services
    ttsServiceMock = require('../../../server/services/TextToSpeechService').textToSpeechService;
    
    // Clear all mocks before each test
    vi.clearAllMocks();
    (global.mockTranslationTranscribe as any).mockClear();
    (global.mockTranslationCompletion as any).mockClear();
  });
  
  describe('Basic Translation', () => {
    it('should translate speech from audio input', async () => {
      // Arrange
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      // Act
      const result = await translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Assert
      expect(result).toBeDefined();
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('This is a translated test response');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      // Verify the OpenAI transcription was called
      expect(global.mockTranslationTranscribe).toHaveBeenCalled();
      
      // Verify the OpenAI translation was called
      expect(global.mockTranslationCompletion).toHaveBeenCalled();
      
      // Verify text-to-speech was called for the translated text
      expect(ttsServiceMock.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'This is a translated test response',
          languageCode: targetLanguage
        })
      );
    });
    
    it('should skip transcription when text is provided', async () => {
      // Arrange
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      const preTranscribedText = 'Pre-transcribed test content';
      
      // Act
      const result = await translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Assert
      expect(result.originalText).toBe(preTranscribedText);
      expect(result.translatedText).toBe('This is a translated test response');
      
      // Verify the OpenAI transcription was not called
      expect(global.mockTranslationTranscribe).not.toHaveBeenCalled();
      
      // Verify text-to-speech was called
      expect(ttsServiceMock.synthesizeSpeech).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle transcription errors gracefully', async () => {
      // Arrange - Make the OpenAI transcription call fail
      (global.mockTranslationTranscribe as any).mockRejectedValueOnce(
        new Error('Transcription API Error')
      );
      
      // Act
      const audioBuffer = Buffer.from('test audio data');
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      // Assert - Should handle the error and return empty strings
      expect(result).toBeDefined();
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      // Verify TTS was still called (with empty string)
      expect(ttsServiceMock.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          languageCode: 'es-ES'
        })
      );
    });
    
    it('should handle translation errors gracefully', async () => {
      // Arrange - Make the OpenAI completion (translation) call fail
      (global.mockTranslationCompletion as any).mockRejectedValueOnce(
        new Error('Translation API Error')
      );
      
      // Act
      const audioBuffer = Buffer.from('test audio data');
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      // Assert - Should return original text but empty translated text
      expect(result).toBeDefined();
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      // Verify TTS was still called (with empty string)
      expect(ttsServiceMock.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          languageCode: 'es-ES'
        })
      );
    });
    
    it('should handle TTS errors gracefully', async () => {
      // Arrange - Make the TTS call fail
      ttsServiceMock.synthesizeSpeech.mockRejectedValueOnce(
        new Error('TTS API Error')
      );
      
      // Act
      const audioBuffer = Buffer.from('test audio data');
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      // Assert - Should return empty audio buffer
      expect(result).toBeDefined();
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('This is a translated test response');
      expect(result.audioBuffer).toEqual(Buffer.from(''));
    });
  });
  
  describe('Language Handling', () => {
    it('should skip translation when source and target languages are the same', async () => {
      // Arrange
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      // Act
      const result = await translateSpeech(
        audioBuffer,
        language,
        language
      );
      
      // Assert
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('This is a test transcription');
      
      // Translation API should not be called when languages are the same
      expect(global.mockTranslationCompletion).not.toHaveBeenCalled();
      
      // TTS should still be called
      expect(ttsServiceMock.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'This is a test transcription',
          languageCode: language
        })
      );
    });
  });
});
