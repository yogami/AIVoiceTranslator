/**
 * Translation Service Unit Tests
 * 
 * This file tests the actual translation functionality from the application's
 * openai.ts module, which serves as a facade for the TranslationService.
 */

import { TranslationResult } from '../../../server/openai';
import { jest, expect, describe, it, beforeEach } from '@jest/globals';

// Mock the internal TranslationService that our facade calls (dependency, not the SUT)
jest.mock('../../../server/services/TranslationService', () => {
  return {
    speechTranslationService: {
      translateSpeech: jest.fn().mockImplementation(async (
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
    }
  };
});

// Mock the config (external dependency)
jest.mock('../../../server/config', () => ({
  OPENAI_API_KEY: 'test-api-key'
}));

describe('Translation Result Interface', () => {
  it('should define a consistent result format', () => {
    const result: TranslationResult = {
      originalText: 'Hello',
      translatedText: 'Hola',
      audioBuffer: Buffer.from('test audio')
    };
    
    expect(result).toBeDefined();
    expect(result.originalText).toBe('Hello');
    expect(result.translatedText).toBe('Hola');
    expect(Buffer.isBuffer(result.audioBuffer)).toBeTruthy();
  });
});

describe('Translation Facade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });
  
  it('should use the real translation facade to translate text', async () => {
    // Dynamically import the ACTUAL facade module to test
    const { translateSpeech } = require('../../../server/openai');
    
    // Use the actual function with mocked dependencies
    const result = await translateSpeech(
      Buffer.from('test audio'),
      'en-US',
      'es-ES'
    );
    
    // Verify integration with the speech translation service
    const translationService = require('../../../server/services/TranslationService');
    expect(translationService.speechTranslationService.translateSpeech).toHaveBeenCalledWith(
      expect.any(Buffer),
      'en-US',
      'es-ES',
      undefined
    );
    
    // Verify the result structure is correct
    expect(result).toHaveProperty('originalText');
    expect(result).toHaveProperty('translatedText');
    expect(result).toHaveProperty('audioBuffer');
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('This is a test translation');
    expect(Buffer.isBuffer(result.audioBuffer)).toBeTruthy();
  });
  
  it('should bypass transcription when preTranscribedText is provided', async () => {
    // Dynamically import the ACTUAL facade module to test
    const { translateSpeech } = require('../../../server/openai');
    
    // Use the actual facade with a preTranscribedText parameter
    const result = await translateSpeech(
      Buffer.from('test audio'),
      'en-US',
      'es-ES',
      'Pre-transcribed text'
    );
    
    // Verify integration with the speech translation service
    const translationService = require('../../../server/services/TranslationService');
    expect(translationService.speechTranslationService.translateSpeech).toHaveBeenCalledWith(
      expect.any(Buffer),
      'en-US',
      'es-ES',
      'Pre-transcribed text'
    );
    
    // Verify the result has the correct original text
    expect(result.originalText).toBe('Pre-transcribed text');
  });
});