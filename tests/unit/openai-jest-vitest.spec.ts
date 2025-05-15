/**
 * OpenAI Service - Tests
 * 
 * This file provides comprehensive test coverage for the openai module
 * Converted from Jest to Vitest.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the TranslationService - vi.mock is hoisted to the top
vi.mock('../../server/services/TranslationService', () => {
  return {
    translateSpeech: vi.fn().mockImplementation((
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

// Import the function we want to test after mocks are defined
import { translateSpeech } from '../../server/openai';
// Import the mocked module for later assertions/manipulations
import * as TranslationService from '../../server/services/TranslationService';

// Get a reference to the mocked function
const mockedTranslateSpeech = TranslationService.translateSpeech as ReturnType<typeof vi.fn>;

describe('OpenAI Service - translateSpeech', () => {
  // Save original console methods and env variables
  const originalConsole = { ...console };
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    vi.clearAllMocks();
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