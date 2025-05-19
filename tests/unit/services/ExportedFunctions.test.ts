/**
 * Tests for exported functions in TranslationService
 * Focused specifically on covering the legacy wrapper function
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock these dependencies first
vi.mock('../../../server/services/TextToSpeechService', () => ({
  ttsFactory: {
    getService: vi.fn().mockReturnValue({
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-data'))
    })
  },
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-data'))
  }
}));

// Now we can import our module
import * as TranslationService from '../../../server/services/TranslationService';

describe('translateSpeech legacy wrapper function', () => {
  let consoleLogSpy;
  
  beforeEach(() => {
    // Mock console.log to avoid cluttering test output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock the SpeechTranslationService
    vi.spyOn(TranslationService.speechTranslationService, 'translateSpeech')
      .mockImplementation(async (buffer, source, target, preTranscribed, options) => {
        return {
          originalText: preTranscribed || 'Mocked original',
          translatedText: 'Mocked translation',
          audioBuffer: Buffer.from('mock-audio')
        };
      });
  });
  
  afterEach(() => {
    // Clean up mocks
    vi.restoreAllMocks();
  });
  
  it('should handle string ttsServiceType parameter', async () => {
    // Call the wrapper with a string parameter
    const result = await TranslationService.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es',
      'Hello world',
      'google'
    );
    
    // Verify it was converted to the expected object format
    expect(TranslationService.speechTranslationService.translateSpeech)
      .toHaveBeenCalledWith(
        expect.any(Buffer),
        'en',
        'es',
        'Hello world',
        { ttsServiceType: 'google' }
      );
    
    // Check log message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Using TTS service 'google' (string format)"
    );
    
    // Verify result
    expect(result).toEqual({
      originalText: 'Hello world',
      translatedText: 'Mocked translation',
      audioBuffer: expect.any(Buffer)
    });
  });
  
  it('should handle object ttsServiceType parameter', async () => {
    // Call the wrapper with an object parameter
    const serviceOptions = { ttsServiceType: 'azure', extraOption: true };
    
    const result = await TranslationService.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es',
      'Hello world',
      serviceOptions
    );
    
    // Verify the object was passed through
    expect(TranslationService.speechTranslationService.translateSpeech)
      .toHaveBeenCalledWith(
        expect.any(Buffer),
        'en',
        'es',
        'Hello world',
        serviceOptions
      );
    
    // Check log message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Using TTS service options:',
      serviceOptions
    );
    
    // Verify result
    expect(result).toEqual({
      originalText: 'Hello world',
      translatedText: 'Mocked translation',
      audioBuffer: expect.any(Buffer)
    });
  });
  
  it('should handle undefined ttsServiceType parameter', async () => {
    // Call the wrapper with no service parameter
    const result = await TranslationService.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es',
      'Hello world'
    );
    
    // Verify an empty object was passed
    expect(TranslationService.speechTranslationService.translateSpeech)
      .toHaveBeenCalledWith(
        expect.any(Buffer),
        'en',
        'es',
        'Hello world',
        {}
      );
    
    // Check log message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Using TTS service options:',
      {}
    );
    
    // Verify result
    expect(result).toEqual({
      originalText: 'Hello world',
      translatedText: 'Mocked translation',
      audioBuffer: expect.any(Buffer)
    });
  });
});