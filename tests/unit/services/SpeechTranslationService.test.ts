// filepath: /Users/yamijala/gitprojects/AIVoiceTranslator/tests/unit/services/SpeechTranslationService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createMockTranslationServices, 
  setupConsoleMocks, 
  createTranslateSpeechTest 
} from './translation-test-helpers';
import { 
  SpeechTranslationService,
  TranslationResult,
  translateSpeech,
  speechTranslationService 
} from '../../../server/services/TranslationService';

// Important: We don't mock TextToSpeechService since it's our actual system under test
// Instead, we mock the translation and transcription services which are dependencies

describe('SpeechTranslationService', () => {
  const { mockTranscriptionService, mockTranslationService } = createMockTranslationServices();
  const { consoleLogSpy, consoleErrorSpy } = setupConsoleMocks();
  let service: SpeechTranslationService;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create the service with mocked dependencies
    service = new SpeechTranslationService(
      mockTranscriptionService,
      mockTranslationService,
      true // apiKeyAvailable = true
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should use development mode when API key is not available', async () => {
    // Create a service instance with apiKeyAvailable = false
    const devModeService = new SpeechTranslationService(
      mockTranscriptionService,
      mockTranslationService,
      false
    );
    
    const result = await devModeService.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es'
    );
    
    // Verify the result contains synthetic data
    expect(result.originalText).toContain('development mode');
    expect(result.translatedText).toBeTruthy();
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
    
    // Verify the mocks were not called
    expect(mockTranscriptionService.transcribe).not.toHaveBeenCalled();
    expect(mockTranslationService.translate).not.toHaveBeenCalled();
  });
  
  it('should translate speech with pre-transcribed text', async () => {
    const preTranscribedText = 'This is pre-transcribed text';
    mockTranslationService.translate = vi.fn().mockResolvedValue('Texto pre-transcrito');
    
    const result = await service.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es',
      preTranscribedText
    );
    
    // Verify the translation service was called with correct parameters
    expect(mockTranslationService.translate).toHaveBeenCalledWith(
      preTranscribedText,
      'en',
      'es'
    );
    
    // Verify the transcription service was NOT called
    expect(mockTranscriptionService.transcribe).not.toHaveBeenCalled();
    
    // Verify the result
    expect(result.originalText).toBe(preTranscribedText);
    expect(result.translatedText).toBe('Texto pre-transcrito');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
  
  it('should transcribe and translate speech without pre-transcribed text', async () => {
    const testCase = createTranslateSpeechTest({
      audioBuffer: Buffer.from('audio-data'),
      sourceLang: 'en',
      targetLang: 'es',
      transcribedText: 'Transcribed from audio',
      translatedText: 'Traducido del audio',
      mockTranscriptionService,
      mockTranslationService
    });
    
    await testCase();
  });
  
  it('should handle empty transcription', async () => {
    mockTranscriptionService.transcribe = vi.fn().mockResolvedValue('');
    
    const result = await service.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es'
    );
    
    // Verify the transcription service was called
    expect(mockTranscriptionService.transcribe).toHaveBeenCalled();
    
    // Verify the translation service was NOT called (empty text)
    expect(mockTranslationService.translate).not.toHaveBeenCalled();
    
    // Verify the result has empty strings
    expect(result.originalText).toBe('');
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
  
  it('should handle transcription error', async () => {
    mockTranscriptionService.transcribe = vi.fn().mockRejectedValue(new Error('Transcription failed'));
    
    const result = await service.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es'
    );
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    // Verify result contains error information
    expect(result.originalText).toBe('');
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
  
  it('should handle translation error', async () => {
    const transcribedText = 'Transcribed from audio';
    mockTranscriptionService.transcribe = vi.fn().mockResolvedValue(transcribedText);
    mockTranslationService.translate = vi.fn().mockRejectedValue(new Error('Translation failed'));
    
    const result = await service.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es'
    );
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    // Verify result contains original text
    expect(result.originalText).toBeTruthy();
    // When translation fails, translatedText will be empty string as per the implementation
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
  
  it('should handle TTS service type properly with synthesizeSpeech', async () => {
    await createTranslateSpeechTest({
      audioBuffer: Buffer.from('audio data'),
      sourceLang: 'en',
      targetLang: 'es',
      transcribedText: 'Original text',
      translatedText: 'Translated text',
      mockTranscriptionService,
      mockTranslationService,
      ttsOptions: { ttsServiceType: 'openai' }
    })();
  });
  
  // Test the exported translateSpeech facade function
  describe('translateSpeech function', () => {
    let translateSpeechSpy: any;
    
    beforeEach(() => {
      translateSpeechSpy = vi.spyOn(speechTranslationService, 'translateSpeech');
      translateSpeechSpy.mockResolvedValue({
        originalText: 'Original text',
        translatedText: 'Translated text',
        audioBuffer: Buffer.from('mock-audio-buffer')
      });
    });
    
    afterEach(() => {
      translateSpeechSpy.mockRestore();
    });
    
    it('should handle string service type parameter', async () => {
      const result = await translateSpeech(
        Buffer.from('audio-data'),
        'en',
        'es',
        undefined,
        'openai'
      );
      
      expect(result.originalText).toBe('Original text');
      expect(result.translatedText).toBe('Translated text');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Using TTS service 'openai'")
      );
      
      expect(translateSpeechSpy).toHaveBeenCalledWith(
        expect.any(Buffer),
        'en',
        'es',
        undefined,
        { ttsServiceType: 'openai' }
      );
    });
    
    it('should handle object service type parameter', async () => {
      const options = { ttsServiceType: 'browser' };
      
      const result = await translateSpeech(
        Buffer.from('audio-data'),
        'en',
        'es',
        'Pre-transcribed text',
        options
      );
      
      expect(result.originalText).toBe('Original text');
      expect(result.translatedText).toBe('Translated text');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Using TTS service options:',
        options
      );
      
      expect(translateSpeechSpy).toHaveBeenCalledWith(
        expect.any(Buffer),
        'en',
        'es',
        'Pre-transcribed text',
        options
      );
    });
    
    it('should handle undefined service type parameter', async () => {
      const result = await translateSpeech(
        Buffer.from('audio-data'),
        'en',
        'es'
      );
      
      expect(result.originalText).toBe('Original text');
      expect(result.translatedText).toBe('Translated text');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Using TTS service options:',
        {}
      );
      
      expect(translateSpeechSpy).toHaveBeenCalledWith(
        expect.any(Buffer),
        'en',
        'es',
        undefined,
        {}
      );
    });
  });
});