/**
 * Translation Service Unit Tests
 * 
 * This file tests the actual translation functionality from the application's
 * openai.ts module, which serves as a facade for the TranslationService.
 * 
 * Converted from Jest to Vitest
 */

import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';

// IMPORTANT: vi.mock is hoisted to the top of the file automatically
// This means we must define mocks before any imports
vi.mock('../../../server/services/TranslationService', () => {
  return {
    translateSpeech: vi.fn().mockImplementation(async (
      audioBuffer: Buffer, 
      sourceLanguage: string, 
      targetLanguage: string,
      preTranscribedText?: string
    ) => {
      return {
        originalText: preTranscribedText || 'This is a test transcription',
        translatedText: 'This is a test translation',
        audioBuffer: Buffer.from('test audio response')
      };
    })
  };
});

// Import modules after all mocks are defined
import { translateSpeech, TranslationResult } from '../../../server/openai';
import * as TranslationService from '../../../server/services/TranslationService';

// Get a typed reference to the mocked function for use in our tests
const mockTranslateSpeech = TranslationService.translateSpeech as ReturnType<typeof vi.fn>;

describe('TranslationService', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });
  
  it('should translate speech and return results', async () => {
    // Arrange - Create a test audio buffer
    const testAudioBuffer = Buffer.from('test audio data');
    
    // Act - Call the function under test
    const result: TranslationResult = await translateSpeech(
      testAudioBuffer,
      'en-US',
      'es-ES'
    );
    
    // Assert - Verify the response format and content
    expect(result).toBeDefined();
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('This is a test translation');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
    
    // Verify the mock service was called with correct parameters
    expect(mockTranslateSpeech).toHaveBeenCalledWith(
      testAudioBuffer,
      'en-US',
      'es-ES',
      undefined
    );
  });
  
  it('should pass pre-transcribed text when provided', async () => {
    // Arrange - Create a test audio buffer and pre-transcribed text
    const testAudioBuffer = Buffer.from('test audio data');
    const preTranscribedText = 'Pre-transcribed content';
    
    // Act - Call the function with pre-transcribed text
    const result = await translateSpeech(
      testAudioBuffer,
      'en-US',
      'fr-FR',
      preTranscribedText
    );
    
    // Assert - Verify the service was called with the provided text
    expect(mockTranslateSpeech).toHaveBeenCalledWith(
      testAudioBuffer,
      'en-US',
      'fr-FR',
      preTranscribedText
    );
    
    // Original text should be the pre-transcribed text
    expect(result.originalText).toBe(preTranscribedText);
  });
  
  it('should handle translation service errors', async () => {
    // Arrange - Create a test audio buffer
    const testAudioBuffer = Buffer.from('test audio data');
    
    // Mock the translation service to throw an error for this specific test
    mockTranslateSpeech.mockImplementationOnce(() => {
      throw new Error('Translation service error');
    });
    
    // Act & Assert - Verify the error is propagated
    await expect(() => 
      translateSpeech(testAudioBuffer, 'en-US', 'de-DE')
    ).rejects.toThrow('Translation service error');
  });
});