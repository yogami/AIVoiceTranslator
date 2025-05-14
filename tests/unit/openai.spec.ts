/**
 * Tests for the OpenAI facade module
 * 
 * This file tests the main openai.ts module which serves as a facade
 * to the translation service implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the translation service
vi.mock('../../server/services/TranslationService', () => {
  return {
    translateSpeech: vi.fn().mockResolvedValue({
      originalText: 'Original test text',
      translatedText: 'Translated test text',
      audioBuffer: Buffer.from('Test audio data')
    })
  };
});

describe('OpenAI Facade Module', () => {
  let openaiModule: typeof import('../../server/openai');
  
  beforeEach(async () => {
    // Clear mocks and reset modules between tests
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module under test
    openaiModule = await import('../../server/openai');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should export the translateSpeech function', () => {
    expect(typeof openaiModule.translateSpeech).toBe('function');
  });
  
  it('should correctly pass parameters to the translation service', async () => {
    // Arrange
    const audioBuffer = Buffer.from('Test audio data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await openaiModule.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert
    // Import the mocked translateSpeech to verify calls
    const { translateSpeech } = await import('../../server/services/TranslationService');
    
    // Verify the parameters were passed correctly
    expect(translateSpeech).toHaveBeenCalledWith(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      undefined
    );
    
    // Since we've mocked the service to return a specific result,
    // we expect the facade to return that exact result
    expect(result).toEqual({
      originalText: 'Original test text',
      translatedText: 'Translated test text',
      audioBuffer: expect.any(Buffer)
    });
  });
  
  it('should pass preTranscribedText when provided', async () => {
    // Arrange
    const audioBuffer = Buffer.from('Test audio data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'Pre-transcribed text';
    
    // Act
    const result = await openaiModule.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Assert
    const { translateSpeech } = await import('../../server/services/TranslationService');
    
    // Verify preTranscribedText was passed
    expect(translateSpeech).toHaveBeenCalledWith(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
  });
  
  it('should return the TranslationResult from the service', async () => {
    // Arrange
    const audioBuffer = Buffer.from('Test audio data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Import and modify the mock to return a specific result
    const { translateSpeech } = await import('../../server/services/TranslationService');
    const customResult = {
      originalText: 'Custom original text',
      translatedText: 'Custom translated text',
      audioBuffer: Buffer.from('Custom audio data')
    };
    (translateSpeech as any).mockResolvedValueOnce(customResult);
    
    // Act
    const result = await openaiModule.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert
    expect(result).toBe(customResult);
  });
});