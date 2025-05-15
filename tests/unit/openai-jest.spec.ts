/**
 * OpenAI Service - Tests
 * 
 * This file provides comprehensive test coverage for the openai module
 * using Jest instead of Vitest for compatibility with the test environment.
 */
import { jest } from '@jest/globals';

// Mock the TranslationService
jest.mock('../../server/services/TranslationService', () => {
  return {
    translateSpeech: jest.fn().mockImplementation((
      audioBuffer, 
      sourceLanguage, 
      targetLanguage, 
      preTranscribedText
    ) => {
      return Promise.resolve({
        originalText: preTranscribedText || 'This is a test transcription',
        translatedText: 'This is a translated text',
        audioBuffer: Buffer.from('Test audio data')
      });
    })
  };
});

// Import the function we want to test
import { translateSpeech } from '../../server/openai';

describe('OpenAI Service - translateSpeech', () => {
  // Save original console methods and env variables
  const originalConsole = { ...console };
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Restore environment variables
    process.env = originalEnv;
  });
  
  it('should transcribe and translate speech', async () => {
    // Create a mock audio buffer
    const audioBuffer = Buffer.from('test-audio-data');
    
    // Call the function
    const result = await translateSpeech(
      audioBuffer,
      'en',
      'es'
    );
    
    // Check the result
    expect(result).toBeDefined();
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('This is a translated text');
    expect(result.audioBuffer).toBeDefined();
  });
  
  it('should skip transcription when preTranscribedText is provided', async () => {
    // Create a mock audio buffer
    const audioBuffer = Buffer.from('test-audio-data');
    const preTranscribedText = 'Pre-transcribed text';
    
    // Call the function
    const result = await translateSpeech(
      audioBuffer,
      'en',
      'es',
      preTranscribedText
    );
    
    // Check the result
    expect(result).toBeDefined();
    expect(result.originalText).toBe(preTranscribedText);
    expect(result.translatedText).toBe('This is a translated text');
    expect(result.audioBuffer).toBeDefined();
  });

  it('should handle calls with different language combinations', async () => {
    // Test with various language pairs
    const languagePairs = [
      { source: 'en-US', target: 'fr-FR' },
      { source: 'fr-FR', target: 'es-ES' },
      { source: 'es-ES', target: 'de-DE' },
      { source: 'de-DE', target: 'en-US' },
    ];

    const audioBuffer = Buffer.from('test-audio-data');

    for (const pair of languagePairs) {
      const result = await translateSpeech(
        audioBuffer,
        pair.source,
        pair.target
      );
      
      expect(result).toBeDefined();
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('This is a translated text');
      expect(result.audioBuffer).toBeDefined();
    }
  });

  it('should handle empty audio buffer gracefully', async () => {
    // Import the mocked translation service
    const { translateSpeech: mockedTranslateSpeech } = require('../../server/services/TranslationService');
    
    // Mock implementation for empty buffer
    mockedTranslateSpeech.mockImplementationOnce(() => {
      return Promise.resolve({
        originalText: '',
        translatedText: '',
        audioBuffer: Buffer.alloc(0)
      });
    });

    // Call with empty audio buffer
    const result = await translateSpeech(
      Buffer.alloc(0),
      'en-US',
      'fr-FR'
    );
    
    // Should return empty results
    expect(result.originalText).toBe('');
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer.length).toBe(0);
  });
});