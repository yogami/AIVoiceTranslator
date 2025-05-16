/**
 * TranslationService Tests (Consolidated)
 * 
 * A comprehensive test suite for the TranslationService functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'buffer';

// Mock modules - define mocks without referencing external constants
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'This is a test transcription'
          })
        }
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'This is a translated test response' } }]
          })
        }
      }
    }))
  };
});

vi.mock('../../../server/services/TextToSpeechService', () => ({
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio data'))
  }
}));

// Import the module under test
import { translateSpeech } from '../../../server/services/TranslationService';

describe('TranslationService', () => {
  let mockTranscribe;
  let mockCompletion;
  let mockSynthesizeSpeech;
  
  beforeEach(() => {
    // Get references to the mocked functions
    const OpenAIMock = require('openai').default;
    const openaiInstance = new OpenAIMock();
    mockTranscribe = openaiInstance.audio.transcriptions.create;
    mockCompletion = openaiInstance.chat.completions.create;
    mockSynthesizeSpeech = require('../../../server/services/TextToSpeechService').textToSpeechService.synthesizeSpeech;
    
    // Clear all mocks before each test
    vi.clearAllMocks();
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
      
      // Verify mock calls
      expect(mockTranscribe).toHaveBeenCalled();
      expect(mockCompletion).toHaveBeenCalled();
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
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
      
      // Verify mock calls
      expect(mockTranscribe).not.toHaveBeenCalled();
      expect(mockSynthesizeSpeech).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle transcription errors gracefully', async () => {
      // Arrange - Make the OpenAI transcription call fail
      mockTranscribe.mockRejectedValueOnce(new Error('Transcription API Error'));
      
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
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          languageCode: 'es-ES'
        })
      );
    });
    
    it('should handle translation errors gracefully', async () => {
      // Arrange - Make the OpenAI completion (translation) call fail
      mockCompletion.mockRejectedValueOnce(new Error('Translation API Error'));
      
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
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          languageCode: 'es-ES'
        })
      );
    });
    
    it('should handle TTS errors gracefully', async () => {
      // Arrange - Make the TTS call fail
      mockSynthesizeSpeech.mockRejectedValueOnce(new Error('TTS API Error'));
      
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
      expect(mockCompletion).not.toHaveBeenCalled();
      
      // TTS should still be called
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'This is a test transcription',
          languageCode: language
        })
      );
    });
  });
});