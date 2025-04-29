/**
 * Unit tests for the TranslationService
 * 
 * These tests verify the correct error handling in the TranslationService.
 */

// Use commonjs imports for jest compatibility
import fs from 'fs';
import { OpenAI } from 'openai';

// Mocks
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockImplementation(async () => {
            return { text: 'Mocked transcription text' };
          }),
        },
      },
      chat: {
        completions: {
          create: jest.fn().mockImplementation(async () => {
            return {
              choices: [
                {
                  message: {
                    content: 'Mocked translated text',
                  },
                },
              ],
            };
          }),
        },
      },
    })),
  };
});

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  process.env.OPENAI_API_KEY = 'mock-api-key';
  process.env.NODE_ENV = 'development';
});

afterEach(() => {
  process.env = originalEnv;
});

// Import after mocking
import {
  speechTranslationService,
  translateSpeech,
  TranslationResult,
} from '../../server/services/TranslationService';

describe('TranslationService', () => {
  // Create a mock audio buffer
  const mockAudioBuffer = Buffer.from('mock audio data');
  
  describe('Error Handling', () => {
    test('should use development mode when API key is missing', async () => {
      // Set API key to undefined to test development mode
      process.env.OPENAI_API_KEY = undefined;
      
      // Re-import to create new instance with updated environment
      jest.resetModules();
      const { translateSpeech } = require('../../server/services/TranslationService');
      
      // Call translate function
      const result = await translateSpeech(mockAudioBuffer, 'en', 'es');
      
      // Verify we get a development mode response
      expect(result).toBeDefined();
      expect(result.originalText).toBeDefined();
      expect(result.translatedText).toBeDefined();
      expect(result.audioBuffer).toBeDefined();
      
      // Development mode should provide a Spanish message for Spanish target language
      expect(result.translatedText).toContain('es una traducción');
    });
    
    test('should propagate errors in test environment', async () => {
      // Set environment to test
      process.env.NODE_ENV = 'test';
      
      // Mock OpenAI to throw an error
      jest.resetModules();
      jest.mock('openai', () => {
        return {
          OpenAI: jest.fn().mockImplementation(() => ({
            audio: {
              transcriptions: {
                create: jest.fn().mockRejectedValue(new Error('API error')),
              },
            },
            chat: {
              completions: {
                create: jest.fn().mockRejectedValue(new Error('API error')),
              },
            },
          })),
        };
      });
      
      // Re-import with mocked environment
      const { translateSpeech } = require('../../server/services/TranslationService');
      
      // Test should throw an error in test environment
      await expect(translateSpeech(mockAudioBuffer, 'en', 'es')).rejects.toThrow();
    });
    
    test('should fallback gracefully in production environment', async () => {
      // Set environment to production
      process.env.NODE_ENV = 'production';
      
      // Mock OpenAI to throw an error
      jest.resetModules();
      jest.mock('openai', () => {
        return {
          OpenAI: jest.fn().mockImplementation(() => ({
            audio: {
              transcriptions: {
                create: jest.fn().mockRejectedValue(new Error('API error')),
              },
            },
            chat: {
              completions: {
                create: jest.fn().mockRejectedValue(new Error('API error')),
              },
            },
          })),
        };
      });
      
      // Re-import with mocked environment
      const { translateSpeech } = require('../../server/services/TranslationService');
      
      // Test should not throw in production environment and return fallback
      const result = await translateSpeech(mockAudioBuffer, 'en', 'es');
      expect(result).toBeDefined();
      // Empty text indicates a graceful fallback occurred
      expect(result.originalText).toBe('');
    });
  });
});
