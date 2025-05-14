/**
 * Tests for the OpenAI facade module
 * 
 * This file tests the main openai.ts module which serves as a facade
 * to the translation service implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a translation result mock that will be used for the tests
const mockDefaultTranslationResult = {
  originalText: 'Original test text',
  translatedText: 'Translated test text',
  audioBuffer: Buffer.from('Test audio data')
};

// Mock the translation service before importing the module under test
vi.mock('../../server/services/TranslationService', () => {
  return {
    translateSpeech: vi.fn().mockImplementation(() => {
      return Promise.resolve({...mockDefaultTranslationResult});
    })
  };
});

describe('OpenAI Facade Module', () => {
  let openaiModule: any;
  let translationServiceMock: any;
  
  beforeEach(async () => {
    // Clear mocks
    vi.clearAllMocks();
    
    // Import modules for testing
    openaiModule = await import('../../server/openai');
    translationServiceMock = await import('../../server/services/TranslationService');
  });
  
  afterEach(() => {
    vi.resetModules();
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
    await openaiModule.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert - verify parameters were passed correctly
    expect(translationServiceMock.translateSpeech).toHaveBeenCalledWith(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      undefined
    );
  });
  
  it('should pass preTranscribedText when provided', async () => {
    // Arrange
    const audioBuffer = Buffer.from('Test audio data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'Pre-transcribed text';
    
    // Act
    await openaiModule.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Assert - verify preTranscribedText was passed
    expect(translationServiceMock.translateSpeech).toHaveBeenCalledWith(
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
    
    const customResult = {
      originalText: 'Custom original text',
      translatedText: 'Custom translated text',
      audioBuffer: Buffer.from('Custom audio data')
    };
    
    // Set up a special mock implementation for this test
    translationServiceMock.translateSpeech.mockImplementationOnce(() => {
      return Promise.resolve(customResult);
    });
    
    // Act
    const result = await openaiModule.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert - should return what the service returned
    expect(result).toEqual(customResult);
  });
});