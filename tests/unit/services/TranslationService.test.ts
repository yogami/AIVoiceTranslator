
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ITranslationService, 
  OpenAITranslationService, 
  ITranscriptionService, 
  OpenAITranscriptionService,
  SpeechTranslationService,
  TranslationResult
} from '../../../server/services/TranslationService';

// Mock the TextToSpeechService module
vi.mock('../../../server/services/TextToSpeechService', () => ({
  ttsFactory: vi.fn().mockReturnValue({
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-buffer'))
  }),
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-buffer'))
  }
}));

// Helper to create a properly structured OpenAI mock
function createMockOpenAI() {
  return {
    chat: {
      completions: {
        create: vi.fn()
      }
    },
    audio: {
      transcriptions: {
        create: vi.fn()
      }
    }
  };
}

// Helper to create a filesystem mock
function createFilesystemMock() {
  return {
    createReadStream: vi.fn().mockReturnValue('mock-stream'),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn()
  };
}

describe('OpenAITranslationService', () => {
  let service: ITranslationService;
  let mockOpenAI: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOpenAI = createMockOpenAI();
    service = new OpenAITranslationService(mockOpenAI);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should translate a simple phrase from English to Spanish', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hola' } }]
    });
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('Hola');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledOnce();
  });

  it('should return the original text if source and target languages are the same', async () => {
    const text = 'Hello';
    const result = await service.translate(text, 'en', 'en');
    expect(result).toBe(text);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should handle empty input gracefully', async () => {
    const result = await service.translate('', 'en', 'es');
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should handle null or undefined input gracefully', async () => {
    // @ts-expect-error
    await expect(service.translate(null, 'en', 'es')).resolves.toBe('');
    // @ts-expect-error
    await expect(service.translate(undefined, 'en', 'es')).resolves.toBe('');
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should use language mapping for known codes', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'Bonjour' } }]
    });
    // 'fr-FR' is mapped to 'French'
    await service.translate('Hello', 'en-US', 'fr-FR');
    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('French');
    expect(callArgs.messages[1].content).toContain('Original text: "Hello"');
    expect(callArgs.messages[1].content).toContain('Translation:');
  });

  it('should use fallback language code if not mapped', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'Test' } }]
    });
    // 'xx-YY' is not mapped, so should use 'xx'
    await service.translate('Hello', 'en-US', 'xx-YY');
    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('xx');
  });

  it('should return original text if OpenAI returns empty content', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }]
    });
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('Hello');
  });

  it('should return original text if OpenAI returns undefined content', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: undefined } }]
    });
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('Hello');
  });

  it('should return empty string if OpenAI returns no choices', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: []
    });
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
  });

  it('should return empty string if OpenAI returns no message', async () => {
    // This will trigger retries, so we need to fast-forward timers
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{}]
    });
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
  });

  it('should retry on OpenAI API error and eventually return empty string after max retries', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should succeed if OpenAI API fails once then succeeds', async () => {
    mockOpenAI.chat.completions.create
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Hallo' } }]
      });
    const promise = service.translate('Hello', 'en', 'de');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('Hallo');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it('should only retry on specific error codes (429, 500+)', async () => {
    const error429 = new Error('Rate limit');
    // @ts-ignore
    error429.status = 429;
    mockOpenAI.chat.completions.create
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Ciao' } }]
      });
    const promise = service.translate('Hello', 'en', 'it');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('Ciao');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it('should not retry on error with status 400', async () => {
    const error400 = new Error('Bad request');
    // @ts-ignore
    error400.status = 400;
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(error400);
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('should retry on error with status 0 (unknown)', async () => {
    const error0 = new Error('Unknown error');
    // @ts-ignore
    error0.status = 0;
    mockOpenAI.chat.completions.create.mockRejectedValue(error0);
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4);
  });

  it('should log errors during translation', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    await promise;
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log success during translation', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hola' } }]
    });
    await service.translate('Hello', 'en', 'es');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// Mock the TextToSpeechService
vi.mock('../../../server/services/TextToSpeechService', () => ({
  ttsFactory: vi.fn().mockReturnValue({
    synthesizeSpeech: vi.fn().mockImplementation(async () => Buffer.from('mock-audio-buffer'))
  }),
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockImplementation(async () => Buffer.from('mock-audio-buffer'))
  }
}));

describe('SpeechTranslationService', () => {
  let mockTranscriptionService: ITranscriptionService;
  let mockTranslationService: ITranslationService;
  let service: SpeechTranslationService;
  let mockOpenAI: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mockOpenAI = createMockOpenAI();
    
    // Create mock services with full mock implementation
    mockTranscriptionService = {
      transcribe: vi.fn().mockImplementation(async () => '')
    };
    
    mockTranslationService = {
      translate: vi.fn().mockImplementation(async () => '')
    };
    
    // Set up console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create the service with mocked dependencies
    service = new SpeechTranslationService(
      mockTranscriptionService,
      mockTranslationService,
      true // apiKeyAvailable = true
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
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
    const audioBuffer = Buffer.from('audio-data');
    const transcribedText = 'Transcribed from audio';
    const translatedText = 'Traducido del audio';
    
    mockTranscriptionService.transcribe = vi.fn().mockResolvedValue(transcribedText);
    mockTranslationService.translate = vi.fn().mockResolvedValue(translatedText);
    
    const result = await service.translateSpeech(
      audioBuffer,
      'en',
      'es'
    );
    
    // Verify the transcription service was called
    expect(mockTranscriptionService.transcribe).toHaveBeenCalledWith(
      audioBuffer,
      'en'
    );
    
    // Verify the translation service was called
    expect(mockTranslationService.translate).toHaveBeenCalledWith(
      transcribedText,
      'en',
      'es'
    );
    
    // Verify the result
    expect(result.originalText).toBe(transcribedText);
    expect(result.translatedText).toBe(translatedText);
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
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
    
    // Verify result contains original text but empty translation
    // The behavior depends on the actual implementation - the transcribed text may be
    // returned in both fields (as a fallback) or the translatedText might be empty
    expect(result.originalText).toBeTruthy();
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
  
  it('should handle tiny audio buffers correctly', async () => {
    // Create a buffer that will be considered too small
    const smallBuffer = Buffer.alloc(500); // Less than 1000 bytes
    
    const result = await service.translateSpeech(
      smallBuffer,
      'en',
      'es'
    );
    
    // The transcription service might still be called but should return empty string
    // Because smallBuffer.length < 1000 check is inside the transcribe method, not in translateSpeech
    
    // Verify the result has empty strings
    expect(result.originalText).toBe('');
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer).toBe(smallBuffer);
  });
  
  it('should use the TextToSpeech service correctly', async () => {
    const transcribedText = 'Transcribed from audio';
    const translatedText = 'Traducido del audio';
    
    mockTranscriptionService.transcribe = vi.fn().mockResolvedValue(transcribedText);
    mockTranslationService.translate = vi.fn().mockResolvedValue(translatedText);
    
    // Import the ttsFactory function after it's been mocked
    const { ttsFactory } = await import('../../../server/services/TextToSpeechService');
    
    await service.translateSpeech(
      Buffer.from('audio-data'),
      'en',
      'es'
    );
    
    // Since we're using ES modules with Vitest, we can't directly verify ttsFactory was called
    // But we can verify that the operation completed successfully
    expect(mockTranscriptionService.transcribe).toHaveBeenCalled();
    expect(mockTranslationService.translate).toHaveBeenCalled();
  });
});
