/**
 * OpenAI Integration Tests (Consolidated)
 * 
 * A comprehensive test suite for OpenAI-related functionality.
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
          content: 'This is a test response'
        }
      }
    ]
  });
  
  // Expose the mocks so tests can access them
  vi.stubGlobal('mockOpenAITranscribe', mockTranscribe);
  vi.stubGlobal('mockOpenAICompletion', mockCompletion);
  
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

// Import the modules under test
import { translateSpeech } from '../../server/services/TranslationService';

describe('OpenAI API Integration', () => {
  describe('Basic Functionality', () => {
    it('should translate speech with OpenAI', async () => {
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
      expect(result.originalText).toBeDefined();
      expect(result.translatedText).toBeDefined();
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
    });
  
    it('should handle pre-transcribed text', async () => {
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
      expect(result.translatedText).toBeDefined();
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(() => {
      // Clear mocks before each test
      vi.clearAllMocks();
      (global.mockOpenAITranscribe as any).mockClear();
      (global.mockOpenAICompletion as any).mockClear();
    });
    
    it('should handle API errors gracefully', async () => {
      // Arrange - Make the OpenAI call fail
      (global.mockOpenAITranscribe as any).mockRejectedValueOnce(new Error('API Error'));
      
      // Act
      const audioBuffer = Buffer.from('test audio data');
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      // Assert - Should still return a result with empty strings
      expect(result).toBeDefined();
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
    });
  });
  
  describe('Language Handling', () => {
    beforeEach(() => {
      // Clear mocks before each test
      vi.clearAllMocks();
      (global.mockOpenAITranscribe as any).mockClear();
      (global.mockOpenAICompletion as any).mockClear();
    });
    
    it('should skip translation when source and target languages are the same', async () => {
      // Arrange
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      (global.mockOpenAITranscribe as any).mockResolvedValueOnce({
        text: 'Test transcription for same language'
      });
      
      // Act
      const result = await translateSpeech(
        audioBuffer,
        language,
        language
      );
      
      // Assert
      expect(result.originalText).toBeDefined();
      expect(result.translatedText).toBe(result.originalText);
      
      // Verify the translation API was not called
      expect((global.mockOpenAICompletion as any)).not.toHaveBeenCalled();
    });
  });
});