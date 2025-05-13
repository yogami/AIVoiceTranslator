/**
 * Enhanced Translation Service Unit Tests
 * 
 * This file tests the facade (openai.ts) for the TranslationService.
 * We only mock external dependencies, not the SUT itself.
 * 
 * We use dynamic imports to handle ESM module conflicts with jest.
 */
import { jest, expect, describe, it, beforeEach } from '@jest/globals';

// Mock the original TranslationService that our facade calls (dependency, not the SUT)
jest.mock('../../../server/services/TranslationService', () => {
  // Export the actual function interface but with controlled behavior
  return {
    translateSpeech: jest.fn().mockImplementation(async (
      audioBuffer: Buffer, 
      sourceLanguage: string, 
      targetLanguage: string,
      preTranscribedText?: string
    ) => {
      // Simulate behavior based on input parameters
      if (preTranscribedText) {
        return {
          originalText: preTranscribedText,
          translatedText: `Translated: ${preTranscribedText}`,
          audioBuffer: Buffer.from('mock audio data')
        };
      }
      
      return {
        originalText: 'This is a test transcription',
        translatedText: 'Esta es una traducción de prueba',
        audioBuffer: Buffer.from('mock audio data')
      };
    })
  };
});

// Mock config (external dependency)
jest.mock('../../../server/config', () => ({
  OPENAI_API_KEY: 'test-key'
}));

describe('OpenAI Translation Facade', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });
  
  it('should translate speech correctly', async () => {
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Dynamically import the ACTUAL facade function to test
    const { translateSpeech } = await import('../../../server/openai');
    
    // Call the ACTUAL facade function
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Verify expected behavior
    expect(result).toBeDefined();
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('Esta es una traducción de prueba');
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    
    // Verify the facade called the service correctly
    const translationService = require('../../../server/services/TranslationService');
    expect(translationService.translateSpeech).toHaveBeenCalledWith(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      undefined
    );
  });
  
  it('should bypass transcription when preTranscribedText is provided', async () => {
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'Pre-transcribed text for testing';
    
    // Dynamically import the ACTUAL facade function to test
    const { translateSpeech } = await import('../../../server/openai');
    
    // Call the ACTUAL facade function
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Verify expected behavior
    expect(result).toBeDefined();
    expect(result.originalText).toBe(preTranscribedText);
    expect(result.translatedText).toBe(`Translated: ${preTranscribedText}`);
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    
    // Verify the facade called the service correctly
    const translationService = require('../../../server/services/TranslationService');
    expect(translationService.translateSpeech).toHaveBeenCalledWith(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
  });
  
  it('should handle errors gracefully', async () => {
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Set up the mock to throw an error for this test
    const translationService = require('../../../server/services/TranslationService');
    translationService.translateSpeech.mockRejectedValueOnce(new Error('Service Error'));
    
    // Dynamically import the ACTUAL facade function to test
    const { translateSpeech } = await import('../../../server/openai');
    
    // Expect the facade to properly propagate the error
    await expect(translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    )).rejects.toThrow('Service Error');
  });
});