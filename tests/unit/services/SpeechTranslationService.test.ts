/**
 * Speech Translation Service Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechTranslationService } from '../../../server/services/TranslationService';
import { createMockAudioBuffer, setupConsoleMocks } from '../utils/test-helpers';

// Mock the TextToSpeechService
vi.mock('../../../server/services/textToSpeech/TextToSpeechService', () => {
  const mockSynthesizeFunction = vi.fn().mockImplementation(async () => Buffer.from('mock-audio-buffer'));
  const mockTTSService = {
    synthesizeSpeech: mockSynthesizeFunction
  };
  
  return {
    ttsFactory: {
      getService: vi.fn().mockReturnValue(mockTTSService)
    },
    // Export the mock service instance for direct access in tests
    __mockTTSService: mockTTSService
  };
});

// Mock DevelopmentModeHelper
vi.mock('../../../server/services/helpers/DevelopmentModeHelper', () => ({
  DevelopmentModeHelper: {
    getLanguageSpecificTranslation: vi.fn().mockReturnValue('Synthetic dev translation'),
    createSilentAudioBuffer: vi.fn().mockReturnValue(Buffer.from('dev-audio'))
  }
}));

describe('SpeechTranslationService', () => {
  const { consoleLogSpy, consoleErrorSpy } = setupConsoleMocks();
  let service: SpeechTranslationService;
  let mockTranscriptionService: any;
  let mockTranslationService: any;

  beforeEach(async () => {
    // Create mock services
    mockTranscriptionService = {
      transcribe: vi.fn().mockResolvedValue('Transcribed text')
    };
    
    mockTranslationService = {
      translate: vi.fn().mockResolvedValue('Translated text')
    };
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create service instance
    service = new SpeechTranslationService(
      mockTranscriptionService,
      mockTranslationService,
      true
    );
 });

  // Add your tests here
  it('should translate speech', async () => {
    const audioBuffer = createMockAudioBuffer(1000);
    const result = await service.translateSpeech(audioBuffer, 'en-US', 'es-ES');
    
    expect(result).toBeDefined();
    expect(result.originalText).toBe('Transcribed text');
    expect(result.translatedText).toBe('Translated text');
  });

  it('should use preTranscribedText if provided and not call transcription service', async () => {
    const audioBuffer = createMockAudioBuffer(100);
    const preTranscribed = 'This text is already transcribed.';
    
    const result = await service.translateSpeech(audioBuffer, 'en-US', 'es-ES', preTranscribed);

    expect(mockTranscriptionService.transcribe).not.toHaveBeenCalled();
    expect(result.originalText).toBe(preTranscribed);
    expect(result.translatedText).toBe('Translated text'); // Still uses the mock translation of whatever text it got
    expect(mockTranslationService.translate).toHaveBeenCalledWith(preTranscribed, 'en-US', 'es-ES');
  });

  it('should use development mode and return synthetic data if API key is not available', async () => {
    // Re-initialize service with apiKeyAvailable: false
    service = new SpeechTranslationService(
      mockTranscriptionService,
      mockTranslationService,
      false // API Key NOT available
    );

    const audioBuffer = createMockAudioBuffer(100);
    const result = await service.translateSpeech(audioBuffer, 'en-US', 'es-ES');

    // Import DevelopmentModeHelper to check its mock
    const { DevelopmentModeHelper } = await import('../../../server/services/helpers/DevelopmentModeHelper');

    expect(DevelopmentModeHelper.getLanguageSpecificTranslation).toHaveBeenCalledWith(
      'This is a development mode transcription.', // Default text when preTranscribedText is null
      'es-ES'
    );
    expect(DevelopmentModeHelper.createSilentAudioBuffer).toHaveBeenCalled();
    
    expect(result.originalText).toBe('This is a development mode transcription.');
    expect(result.translatedText).toBe('Synthetic dev translation');
    expect(result.audioBuffer.toString()).toBe('dev-audio');

    expect(mockTranscriptionService.transcribe).not.toHaveBeenCalled();
    expect(mockTranslationService.translate).not.toHaveBeenCalled();
  });

  it('should use specified ttsServiceType from options when calling ttsFactory', async () => {
    const audioBuffer = createMockAudioBuffer(100);
    const options = { ttsServiceType: 'custom_tts' };
    
    // Import ttsFactory to check its mock
    const { ttsFactory } = await import('../../../server/services/textToSpeech/TextToSpeechService');
    const getServiceSpy = vi.spyOn(ttsFactory, 'getService'); // Spy on getService

    await service.translateSpeech(audioBuffer, 'en-US', 'es-ES', undefined, options);

    expect(getServiceSpy).toHaveBeenCalledWith(options.ttsServiceType);
    
    getServiceSpy.mockRestore(); // Clean up spy
  });

  it('should return empty texts and original audio if transcription fails', async () => {
    mockTranscriptionService.transcribe.mockRejectedValueOnce(new Error('Transcription failed miserably'));
    
    const audioBuffer = createMockAudioBuffer(100);
    const result = await service.translateSpeech(audioBuffer, 'en-US', 'es-ES');

    expect(result.originalText).toBe('');
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer).toBe(audioBuffer); // Should return original audio buffer
    expect(mockTranslationService.translate).not.toHaveBeenCalled(); // Translation should not be attempted
    
    // Optionally, check if console.error was called (if consoleErrorSpy is active and configured for this)
    // expect(consoleErrorSpy).toHaveBeenCalledWith('Transcription service failed:', expect.any(Error));
  });

  it('should return original text and attempt TTS on original if translation fails', async () => {
    const originalTranscription = 'Successfully transcribed text';
    mockTranscriptionService.transcribe.mockResolvedValueOnce(originalTranscription);
    mockTranslationService.translate.mockRejectedValueOnce(new Error('Translation service is down'));

    // Patch the singleton ttsFactory.getService to always return a valid mock
    const { ttsFactory } = await import('../../../server/services/textToSpeech/TextToSpeechService');
    const ttsServiceInstance = { synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-buffer')) };
    vi.spyOn(ttsFactory, 'getService').mockReturnValue(ttsServiceInstance);
    const synthesizeSpy = vi.spyOn(ttsServiceInstance, 'synthesizeSpeech');

    const audioBuffer = createMockAudioBuffer(100);
    const result = await service.translateSpeech(audioBuffer, 'en-US', 'es-ES');

    expect(result.originalText).toBe(originalTranscription);
    expect(result.translatedText).toBe('');
    expect(synthesizeSpy).toHaveBeenCalled();
    expect(synthesizeSpy).toHaveBeenCalledWith(expect.objectContaining({
      text: originalTranscription,
      languageCode: 'es-ES'
    }));
    expect(result.audioBuffer.toString()).toBe('mock-audio-buffer');
    synthesizeSpy.mockRestore();
  });

  it('should return translated text with original audio if TTS fails', async () => {
    const originalTranscription = 'Some transcribed text';
    const successfullyTranslatedText = 'Texto traducido';
    mockTranscriptionService.transcribe.mockResolvedValueOnce(originalTranscription);
    mockTranslationService.translate.mockResolvedValueOnce(successfullyTranslatedText);

    // Patch the singleton ttsFactory.getService to always return a valid mock
    const { ttsFactory } = await import('../../../server/services/textToSpeech/TextToSpeechService');
    const ttsServiceInstance = { synthesizeSpeech: vi.fn().mockRejectedValueOnce(new Error('TTS boom')) };
    vi.spyOn(ttsFactory, 'getService').mockReturnValue(ttsServiceInstance);
    const synthesizeSpy = vi.spyOn(ttsServiceInstance, 'synthesizeSpeech');

    const audioBuffer = createMockAudioBuffer(100, 'original_audio_for_tts_failure_test');
    const result = await service.translateSpeech(audioBuffer, 'en-US', 'es-ES');

    expect(result.originalText).toBe(originalTranscription);
    expect(result.translatedText).toBe(successfullyTranslatedText);
    expect(result.audioBuffer).toBe(audioBuffer);
    expect(synthesizeSpy).toHaveBeenCalled();
    synthesizeSpy.mockRestore();
  });

  it('should return early with empty results if original text is empty', async () => {
    mockTranscriptionService.transcribe.mockResolvedValueOnce(''); // Transcription returns empty
    
    const audioBuffer = createMockAudioBuffer(100);
    const result = await service.translateSpeech(audioBuffer, 'en-US', 'es-ES');

    expect(result.originalText).toBe('');
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer).toBe(audioBuffer); // Should be the original audio buffer

    expect(mockTranslationService.translate).not.toHaveBeenCalled();
    
    // TTS should not have been called either
    const { ttsFactory } = await import('../../../server/services/textToSpeech/TextToSpeechService');
    const ttsServiceInstance = ttsFactory.getService();
    
    // Ensure the service instance is valid before spying
    if (!ttsServiceInstance || typeof ttsServiceInstance.synthesizeSpeech !== 'function') {
      throw new Error('TTS service instance is not properly mocked');
    }
    
    const synthesizeSpy = vi.spyOn(ttsServiceInstance, 'synthesizeSpeech');
    expect(synthesizeSpy).not.toHaveBeenCalled();
    synthesizeSpy.mockRestore(); // Important to restore spy even if not called for cleanup
  });

  // Add more tests here
});