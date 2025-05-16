/**
 * TranslationService Tests (Consolidated)
 * 
 * A comprehensive test suite for the TranslationService functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn(() => ({
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
            choices: [
              {
                message: {
                  content: 'This is a translated test response'
                }
              }
            ]
          })
        }
      }
    }))
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
import { textToSpeechService } from '../../../server/services/TextToSpeechService';

describe('TranslationService', () => {
  let openaiMock;
  let ttsServiceMock;
  
  beforeEach(() => {
    // Get references to the mocked services
    openaiMock = require('openai').default();
    ttsServiceMock = require('../../../server/services/TextToSpeechService').textToSpeechService;
    
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
      
      // Verify the OpenAI transcription was called with the right parameters
      expect(openaiMock.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.any(Object),
          model: expect.any(String),
          language: sourceLanguage.split('-')[0]
        })
      );
      
      // Verify the OpenAI translation was called
      expect(openaiMock.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('translate')
            }),
            expect.objectContaining({
              role: 'user',
              content: 'This is a test transcription'
            })
          ])
        })
      );
      
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
      expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
      
      // Verify text-to-speech was called
      expect(ttsServiceMock.synthesizeSpeech).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle transcription errors gracefully', async () => {
      // Arrange - Make the OpenAI transcription call fail
      openaiMock.audio.transcriptions.create.mockRejectedValueOnce(
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
      openaiMock.chat.completions.create.mockRejectedValueOnce(
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
      expect(openaiMock.chat.completions.create).not.toHaveBeenCalled();
      
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
