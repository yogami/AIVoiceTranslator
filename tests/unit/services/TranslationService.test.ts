/**
 * TranslationService Unit Tests
 * 
 * IMPORTANT: This test properly follows the principle of not mocking the System Under Test (SUT).
 * We only mock external dependencies. We're using dynamic imports for TranslationService
 * to avoid conflicts with ESM's import.meta.url.
 */
import { jest, expect, describe, it, beforeEach } from '@jest/globals';

// Mock external dependencies first
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({
            text: 'This is a test transcription'
          })
        },
        speech: {
          create: jest.fn().mockResolvedValue({
            body: Buffer.from('mock audio data')
          })
        }
      },
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ 
              message: { 
                content: 'This is a test translation' 
              } 
            }]
          })
        }
      }
    }))
  };
});

// Mock config (external dependency)
jest.mock('../../../server/config', () => ({
  OPENAI_API_KEY: 'mock-api-key',
  AUDIO_CACHE_DIR: './audio-cache',
  TRANSLATION_CACHE_EXPIRY: 3600000
}));

// Mock the TextToSpeechService
jest.mock('../../../server/services/TextToSpeechService', () => ({
  textToSpeechService: {
    synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('mock audio data'))
  },
  ttsFactory: {
    getService: jest.fn().mockReturnValue({
      synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('mock audio data'))
    })
  }
}));

describe('Translation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });
  
  it('should translate speech correctly', async () => {
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Dynamically import the service to avoid conflicts with import.meta.url
    const { translateSpeech } = await import('../../../server/services/TranslationService');
    
    // Call the ACTUAL function, not a mock
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('This is a test translation');
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
  });
  
  it('should bypass transcription when preTranscribedText is provided', async () => {
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'Pre-transcribed text for testing';
    
    // Dynamically import the service to avoid conflicts with import.meta.url
    const { translateSpeech } = await import('../../../server/services/TranslationService');
    
    // Call the ACTUAL function, not a mock
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.originalText).toBe(preTranscribedText);
    expect(result.translatedText).toBe('This is a test translation');
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
  });
});