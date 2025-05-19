import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as TranslationModule from '../../../server/services/TranslationService';

// Mock the dependencies
vi.mock('../../../server/services/TextToSpeechService', () => ({
  ttsFactory: vi.fn().mockReturnValue({
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-buffer'))
  }),
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-buffer'))
  }
}));

describe('Legacy translateSpeech wrapper function', () => {
  // Set up a mock for the speech translation service
  let mockSpeechTranslationService: any;
  
  beforeEach(() => {
    // Create a mock result
    const mockResult = {
      originalText: 'Original text',
      translatedText: 'Translated text',
      audioBuffer: Buffer.from('mock-audio')
    };
    
    // Create a spy for the translateSpeech method
    mockSpeechTranslationService = {
      translateSpeech: vi.fn().mockResolvedValue(mockResult)
    };
    
    // Replace the real service with our mock
    vi.spyOn(TranslationModule, 'speechTranslationService', 'get')
      .mockReturnValue(mockSpeechTranslationService);
      
    // Mock console.log to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call translateSpeech with string ttsServiceType', async () => {
    // Call the legacy function with a string ttsServiceType
    const result = await TranslationModule.translateSpeech(
      Buffer.from('audio data'),
      'en',
      'es',
      'pre-transcribed text',
      'google'
    );
    
    // Verify the service was called with correct parameters
    expect(mockSpeechTranslationService.translateSpeech).toHaveBeenCalledWith(
      expect.any(Buffer),
      'en',
      'es',
      'pre-transcribed text',
      { ttsServiceType: 'google' }
    );
    
    // Verify the result was returned unchanged
    expect(result).toEqual({
      originalText: 'Original text',
      translatedText: 'Translated text',
      audioBuffer: expect.any(Buffer)
    });
  });
  
  it('should call translateSpeech with object ttsServiceType', async () => {
    // Call the legacy function with an object ttsServiceType
    const ttsOptions = { ttsServiceType: 'azure' };
    const result = await TranslationModule.translateSpeech(
      Buffer.from('audio data'),
      'en',
      'es',
      'pre-transcribed text',
      ttsOptions
    );
    
    // Verify the service was called with correct parameters
    expect(mockSpeechTranslationService.translateSpeech).toHaveBeenCalledWith(
      expect.any(Buffer),
      'en',
      'es',
      'pre-transcribed text',
      ttsOptions
    );
    
    // Verify the result was returned unchanged
    expect(result).toEqual({
      originalText: 'Original text',
      translatedText: 'Translated text',
      audioBuffer: expect.any(Buffer)
    });
  });
  
  it('should call translateSpeech with undefined ttsServiceType', async () => {
    // Call the legacy function without a ttsServiceType
    const result = await TranslationModule.translateSpeech(
      Buffer.from('audio data'),
      'en',
      'es',
      'pre-transcribed text'
    );
    
    // Verify the service was called with correct parameters and empty options object
    expect(mockSpeechTranslationService.translateSpeech).toHaveBeenCalledWith(
      expect.any(Buffer),
      'en',
      'es',
      'pre-transcribed text',
      {}
    );
    
    // Verify the result was returned unchanged
    expect(result).toEqual({
      originalText: 'Original text',
      translatedText: 'Translated text',
      audioBuffer: expect.any(Buffer)
    });
  });
});

describe('OpenAI client initialization error handling', () => {
  let originalOpenAIKey: string | undefined;
  
  beforeEach(() => {
    // Save the original API key
    originalOpenAIKey = process.env.OPENAI_API_KEY;
    
    // Mock console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore the original API key
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    
    vi.restoreAllMocks();
    
    // Clear the module cache to force re-initialization
    vi.resetModules();
  });
  
  it('should handle initialization errors gracefully', async () => {
    // Set an invalid API key to trigger the error path
    process.env.OPENAI_API_KEY = 'invalid-key-that-will-cause-errors';
    
    // Force an error during OpenAI initialization by importing the module
    // with vi.mock to make the OpenAI constructor throw an error
    vi.doMock('openai', () => {
      return {
        default: class MockOpenAI {
          constructor() {
            throw new Error('Simulated initialization error');
          }
        }
      };
    });
    
    // Import the module after mocking
    const consoleSpy = vi.spyOn(console, 'error');
    
    // Re-import to trigger initialization with our mocked OpenAI
    await import('../../../server/services/TranslationService');
    
    // Verify the error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error initializing OpenAI client:',
      expect.any(Error)
    );
  });
});