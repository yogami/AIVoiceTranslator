/**
 * OpenAI Service - Tests
 * 
 * This file provides comprehensive test coverage for the openai module
 * using Vitest, converted from the original Jest tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the TranslationService
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

// Import the function we want to test
import { translateSpeech } from '../../server/openai';

describe('OpenAI Service - translateSpeech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate speech using TranslationService', async () => {
    // Call translateSpeech with test parameters
    const result = await translateSpeech(
      Buffer.from('Test audio data'),
      'en-US',
      'es-ES'
    );
    
    // Assertions
    expect(result).toBeDefined();
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('This is a translated text');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
  
  it('should pass pre-transcribed text when provided', async () => {
    // Mock the imported translation service
    const mockTranslationService = await import('../../server/services/TranslationService');
    
    // Call translateSpeech with pre-transcribed text
    await translateSpeech(
      Buffer.from('Test audio data'),
      'en-US',
      'fr-FR',
      'Pre-transcribed text'
    );
    
    // Assertions
    expect(mockTranslationService.translateSpeech).toHaveBeenCalledWith(
      expect.any(Buffer),
      'en-US',
      'fr-FR',
      'Pre-transcribed text'
    );
  });
  
  it('should handle missing parameters gracefully', async () => {
    // Call without optional parameters
    const result = await translateSpeech(
      Buffer.from('Test audio data'),
      'en-US',
      'de-DE'
    );
    
    // Should still work without pre-transcribed text
    expect(result).toBeDefined();
    expect(result.translatedText).toBe('This is a translated text');
  });
  
  it('should handle errors from the translation service', async () => {
    // Mock the imported translation service to throw an error
    const mockTranslationService = await import('../../server/services/TranslationService');
    vi.spyOn(mockTranslationService, 'translateSpeech').mockRejectedValueOnce(new Error('Translation failed'));
    
    // Call should reject with the error
    await expect(translateSpeech(
      Buffer.from('Test audio data'),
      'en-US',
      'ja-JP'
    )).rejects.toThrow('Translation failed');
  });
});