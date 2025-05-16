/**
 * OpenAI Integration Tests (Consolidated)
 * 
 * A comprehensive test suite for OpenAI-related functionality.
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
                  content: 'This is a test response'
                }
              }
            ]
          })
        }
      }
    }))
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
    });
    
    it('should handle API errors gracefully', async () => {
      // Arrange - Make the OpenAI call fail
      const mockTranscribe = vi.fn().mockRejectedValue(new Error('API Error'));
      
      // Override the mock implementation for this test
      vi.mocked(require('openai').default).mockImplementationOnce(() => ({
        audio: {
          transcriptions: {
            create: mockTranscribe
          }
        },
        chat: {
          completions: {
            create: vi.fn()
          }
        }
      }));
      
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
    it('should skip translation when source and target languages are the same', async () => {
      // Arrange
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      const mockCreate = vi.fn();
      
      // Override the mock implementation for this test
      vi.mocked(require('openai').default).mockImplementationOnce(() => ({
        audio: {
          transcriptions: {
            create: vi.fn().mockResolvedValue({
              text: 'Test transcription for same language'
            })
          }
        },
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));
      
      // Act
      const result = await translateSpeech(
        audioBuffer,
        language,
        language
      );
      
      // Assert
      expect(result.originalText).toBeDefined();
      expect(result.translatedText).toBe(result.originalText);
      // Translation API should not be called - but we can't directly test this
      // since the service will create a new instance of OpenAI internally
    });
  });
});