/**
 * Translation Service Tests (Consolidated)
 * 
 * Comprehensive test suite for all translation-related services
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ITranscriptionService, 
  ITranslationService, 
  OpenAITranslationService,
  SpeechTranslationService,
  OpenAITranscriptionService
} from '../../../server/services/TranslationService';
import OpenAI from 'openai';
import { createMockOpenAI, createMockAudioBuffer } from '../utils/test-helpers';
import { AudioFileHandler } from '../../../server/services/handlers/AudioFileHandler';
import { Mocked, MockedFunction } from 'vitest';
// import { URL } from 'url';

// Mock the 'ws' library (if still needed for other tests, otherwise remove if only for WebSocketServer.test.ts)
// For this file, 'ws' is not directly used by TranslationService components, so this mock might be here from consolidation.
// Let's assume it's not strictly needed for OpenAITranscriptionService/OpenAITranslationService tests.

// Mock 'fs' to prevent ENOENT errors from createReadStream
vi.mock('fs', async () => {
  const actualFs = await vi.importActual('fs') as typeof import('fs'); 
  const { Readable } = await vi.importActual('stream') as typeof import('stream');

  const mockFsPromises = {
    ...actualFs.promises, // Start with actual promises to ensure all methods are available
    access: vi.fn().mockResolvedValue(undefined), 
    stat: vi.fn().mockResolvedValue({ 
      size: 1000, 
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      dev: 0,
      ino: 0,
      mode: 0,
      nlink: 0,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 0,
      blocks: 0,
      atimeMs: Date.now(),
      mtimeMs: Date.now(),
      ctimeMs: Date.now(),
      birthtimeMs: Date.now(),
      atime: new Date(),
      // mtime: new Date(), // already present
      ctime: new Date(),
      birthtime: new Date(),
    }), 
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')), 
    writeFile: vi.fn().mockResolvedValue(undefined), 
    mkdir: vi.fn().mockResolvedValue(undefined), // Added mkdir
    unlink: vi.fn().mockResolvedValue(undefined) 
  };

  const mockCreateReadStream = vi.fn().mockImplementation((pathArgument: string) => {
    const readable = new Readable();
    readable._read = () => {}; 
    readable.push(Buffer.from('mock stream data for ' + pathArgument));
    readable.push(null);
    // Add properties that might be expected by OpenAI SDK
    (readable as any).path = pathArgument;
    (readable as any).readable = true;
    return readable;
  });

  return {
    // For named imports: import { promises, createReadStream } from 'fs';
    ...actualFs,
    promises: mockFsPromises,
    createReadStream: mockCreateReadStream,
    existsSync: vi.fn().mockReturnValue(true),
    unlinkSync: vi.fn().mockImplementation(() => {}),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('mock file content')),
    writeFileSync: vi.fn().mockImplementation(() => {}),
    constants: actualFs.constants,

    // For default import: import fs from 'fs';
    default: {
      ...actualFs,
      promises: mockFsPromises,
      createReadStream: mockCreateReadStream,
      existsSync: vi.fn().mockReturnValue(true),
      unlinkSync: vi.fn().mockImplementation(() => {}),
      readFileSync: vi.fn().mockReturnValue(Buffer.from('mock file content')),
      writeFileSync: vi.fn().mockImplementation(() => {}),
      constants: actualFs.constants,
    },
  };
});

// Mock the TextToSpeechService
vi.mock('../../../server/services/textToSpeech/TextToSpeechService', () => ({
  ttsFactory: {
    getService: vi.fn().mockReturnValue({
      synthesizeSpeech: vi.fn().mockImplementation(async () => Buffer.from('mock-audio-buffer'))
    })
  },
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockImplementation(async () => Buffer.from('mock-audio-buffer'))
  }
}));

// Mock AudioFileHandler with correct path
vi.mock('../../../server/services/handlers/AudioFileHandler', () => ({
  AudioFileHandler: vi.fn().mockImplementation(() => ({
    createTempFile: vi.fn().mockResolvedValue('/tmp/test-audio.wav'),
    deleteTempFile: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Translation Services', () => {
  describe('OpenAITranslationService', () => {
    let service: ITranslationService;
    let mockOpenAI: OpenAI;

    beforeEach(() => {
      vi.useFakeTimers();
      mockOpenAI = createMockOpenAI();
      service = new OpenAITranslationService(mockOpenAI);
      if (mockOpenAI.chat && mockOpenAI.chat.completions && mockOpenAI.chat.completions.create) {
        (mockOpenAI.chat.completions.create as any).mockClear();
      }
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.clearAllMocks();
    });

    it('should translate text with valid input', async () => {
      const text = 'Hello world';
      const sourceLang = 'en';
      const targetLang = 'es';
      (mockOpenAI.chat.completions.create as any).mockResolvedValueOnce({
        choices: [{ message: { content: 'Hola mundo' } }]
      });
      const result = await service.translate(text, sourceLang, targetLang);
      expect(result).toBe('Hola mundo');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o', 
        messages: expect.any(Array),
        temperature: 0.1,
        max_tokens: 500
      });
    });

    it('should return original text if OpenAI returns no choices', async () => {
      const originalText = 'Hello no choice';
      (mockOpenAI.chat.completions.create as any).mockResolvedValueOnce({ choices: [] });
      const result = await service.translate(originalText, 'en', 'es');
      expect(result).toBe(originalText);
    });

    it('should return original text if OpenAI choice has no message content', async () => {
      const originalText = 'Hello no content';
      (mockOpenAI.chat.completions.create as any).mockResolvedValueOnce({ choices: [{ message: {} }] });
      const result = await service.translate(originalText, 'en', 'es');
      expect(result).toBe(originalText);
    });

    it('should return original text if OpenAI choice message content is null', async () => {
      const originalText = 'Hello null content';
      (mockOpenAI.chat.completions.create as any).mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
      const result = await service.translate(originalText, 'en', 'es');
      expect(result).toBe(originalText);
    });

    it('should retry on API error and eventually return empty string if all retries fail', async () => {
      (mockOpenAI.chat.completions.create as any).mockRejectedValue(new Error('API error'));
      const promise = service.translate('Hello retry', 'en', 'es');
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(Math.pow(2, i) * 1000 + 100);
      }
      const result = await promise;
      expect(result).toBe('');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4);
    });

    it('should_RetryOnError_When_APIFailsWithRetryableError', async () => {
      // Arrange - ensure the mock rejects for all calls
      (mockOpenAI.chat.completions.create as any).mockRejectedValue(new Error('API error'));

      // Act
      const promise = service.translate('Hello', 'en', 'es');
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should_SucceedAfterRetry_When_APIFailsOnceThenSucceeds', async () => {
      // Arrange
      (mockOpenAI.chat.completions.create as any)
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Hallo' } }]
        });

      // Act
      const promise = service.translate('Hello', 'en', 'de');
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('Hallo');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should_RetryOnRateLimit_When_Error429Received', async () => {
      // Arrange
      const error429 = new Error('Rate limit');
      (error429 as any).status = 429;
      
      (mockOpenAI.chat.completions.create as any)
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Ciao' } }]
        });

      // Act
      const promise = service.translate('Hello', 'en', 'it');
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('Ciao');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should_NotRetry_When_Error400Received', async () => {
      // Arrange
      const error400 = new Error('Bad request');
      (error400 as any).status = 400;
      
      (mockOpenAI.chat.completions.create as any).mockRejectedValueOnce(error400);

      // Act
      const result = await service.translate('Hello', 'en', 'es');

      // Assert
      expect(result).toBe('');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should_RetryOnUnknownError_When_Status0', async () => {
      // Arrange
      const error0 = new Error('Unknown error');
      (error0 as any).status = 0;
      
      (mockOpenAI.chat.completions.create as any).mockRejectedValue(error0);

      // Act
      const promise = service.translate('Hello', 'en', 'es');
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4);
    });

    it('should log error when translation eventually fails after retries', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (mockOpenAI.chat.completions.create as any).mockRejectedValue(new Error('Persistent API error'));
      const promise = service.translate('Hello log fail', 'en', 'es');
      for (let i = 0; i < 4; i++) { 
        await vi.advanceTimersByTimeAsync(Math.pow(2, i) * 1000 + 100);
      }
      await promise;

      const consoleErrorCalls = consoleErrorSpy.mock.calls;

      // Check for the log: "Error translating to [targetLanguage]:" ErrorObject
      const errorTranslatingLog = consoleErrorCalls.find(call => 
        call.length === 2 &&
        typeof call[0] === 'string' && call[0].includes('Error translating to es:') &&
        call[1] instanceof Error && (call[1] as Error).message.includes('Persistent API error')
      );
      expect(errorTranslatingLog, 'Expected log for "Error translating to..." not found or incorrect').toBeDefined();

      // Check for the log: "Translation error details: [message]"
      const translationDetailsLog = consoleErrorCalls.find(call =>
        call.length === 1 &&
        typeof call[0] === 'string' && 
        call[0].startsWith('Translation error details:') && 
        call[0].includes('Persistent API error')
      );
      expect(translationDetailsLog, 'Expected log for "Translation error details..." not found or incorrect').toBeDefined();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('OpenAITranscriptionService', () => {
    let service: ITranscriptionService;
    let mockOpenAI: OpenAI;
    let audioFileHandlerCreateMock: MockedFunction<any>;
    let audioFileHandlerDeleteMock: MockedFunction<any>;

    beforeEach(async () => {
      mockOpenAI = createMockOpenAI(); 
      
      // Dynamically import the mocked AudioFileHandler module to access its exports
      // The module itself is mocked at the top of the file.
      const MockedAudioFileHandlerModule = await import('../../../server/services/handlers/AudioFileHandler');
      const MockedAudioFileHandlerConstructor = vi.mocked(MockedAudioFileHandlerModule.AudioFileHandler);

      // Instantiate OpenAITranscriptionService. 
      // It will use the mocked AudioFileHandler constructor due to vi.mock at the top.
      // The default parameter for audioHandler in OpenAITranscriptionService constructor will trigger `new AudioFileHandler()`.
      service = new OpenAITranscriptionService(mockOpenAI); 
      
      // To assert calls on createTempFile/deleteTempFile, we get the methods from the *last instance* 
      // of the mocked AudioFileHandler that was created by the SUT.
      const audioFileHandlerInstances = MockedAudioFileHandlerConstructor.mock.instances;
      if (audioFileHandlerInstances.length === 0) {
        // This might happen if the SUT constructor doesn't immediately create one, or if passed explicitly.
        // For this test setup, OpenAITranscriptionService creates one if not provided.
        // If it IS provided (like in the next line), this path might be an issue.
        // Let's ensure we test the path where it IS provided too.
        // For now, if we always provide it, this branch is less critical.
      }
      
      // Let's explicitly pass a new mocked instance to ensure we control it for assertions
      const explicitMockAudioHandlerInstance = new MockedAudioFileHandlerConstructor();
      service = new OpenAITranscriptionService(mockOpenAI, explicitMockAudioHandlerInstance);

      audioFileHandlerCreateMock = vi.mocked(explicitMockAudioHandlerInstance.createTempFile);
      audioFileHandlerDeleteMock = vi.mocked(explicitMockAudioHandlerInstance.deleteTempFile);

      if (mockOpenAI.audio?.transcriptions?.create) {
        vi.mocked(mockOpenAI.audio.transcriptions.create).mockClear();
      }
      audioFileHandlerCreateMock.mockClear();
      audioFileHandlerDeleteMock.mockClear();
    });

    it('should transcribe audio successfully', async () => {
      const audioBuffer = createMockAudioBuffer(2000, 'some audio');
      const expectedText = "This is a successful transcription.";
      (mockOpenAI.audio.transcriptions.create as any).mockResolvedValueOnce({ text: expectedText });
      audioFileHandlerCreateMock.mockResolvedValueOnce('/tmp/fake-audio.wav');

      const result = await service.transcribe(audioBuffer, 'en-US');

      expect(result).toBe(expectedText);
      expect(audioFileHandlerCreateMock).toHaveBeenCalledWith(audioBuffer);
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
      expect(audioFileHandlerDeleteMock).toHaveBeenCalledWith('/tmp/fake-audio.wav');
    });

    it('should return empty string for audio buffer too small', async () => {
      const audioBuffer = createMockAudioBuffer(100); // Less than 1000 bytes
      const result = await service.transcribe(audioBuffer, 'en-US');
      expect(result).toBe('');
      expect(audioFileHandlerCreateMock).not.toHaveBeenCalled();
      expect(mockOpenAI.audio.transcriptions.create).not.toHaveBeenCalled();
    });

    it('should throw if temp file creation fails', async () => {
      const audioBuffer = createMockAudioBuffer(2000);
      audioFileHandlerCreateMock.mockRejectedValueOnce(new Error('Failed to create temp file'));

      await expect(service.transcribe(audioBuffer, 'en-US'))
        .rejects.toThrow('Transcription failed: Failed to create temp file');
      expect(audioFileHandlerDeleteMock).not.toHaveBeenCalled();
    });
    
    it('should clean up temp file even if transcription API call fails', async () => {
      const audioBuffer = createMockAudioBuffer(2000);
      audioFileHandlerCreateMock.mockResolvedValueOnce('/tmp/cleanup-test.wav');
      (mockOpenAI.audio.transcriptions.create as any).mockRejectedValueOnce(new Error('OpenAI API Error'));

      await expect(service.transcribe(audioBuffer, 'en-US')).rejects.toThrow('Transcription failed: OpenAI API Error');
      expect(audioFileHandlerDeleteMock).toHaveBeenCalledWith('/tmp/cleanup-test.wav');
    });

    it('should return empty string if OpenAI returns no text', async () => {
      const audioBuffer = createMockAudioBuffer(2000);
      audioFileHandlerCreateMock.mockResolvedValueOnce('/tmp/no-text.wav');
      (mockOpenAI.audio.transcriptions.create as any).mockResolvedValueOnce({ text: null }); // or undefined or empty object

      const result = await service.transcribe(audioBuffer, 'en-US');
      expect(result).toBe('');
      expect(audioFileHandlerDeleteMock).toHaveBeenCalledWith('/tmp/no-text.wav');
    });

    it('should return empty string if prompt leakage is detected', async () => {
      const audioBuffer = createMockAudioBuffer(2000);
      const leakyText = "If there is no speech or only background noise, return an empty string. Test.";
      audioFileHandlerCreateMock.mockResolvedValueOnce('/tmp/leaky.wav');
      (mockOpenAI.audio.transcriptions.create as any).mockResolvedValueOnce({ text: leakyText });

      const result = await service.transcribe(audioBuffer, 'en-US');
      expect(result).toBe('');
      expect(audioFileHandlerDeleteMock).toHaveBeenCalledWith('/tmp/leaky.wav');
    });

  }); // End of OpenAITranscriptionService describe

  describe('Legacy translateSpeech function', () => {
    let legacyTranslateSpeechFunction: typeof import('../../../server/services/TranslationService').translateSpeech;
    let speechTranslationServiceMock: Mocked<typeof import('../../../server/services/TranslationService').speechTranslationService>;

    beforeEach(async () => {
      const SUTModule = await import('../../../server/services/TranslationService');
      legacyTranslateSpeechFunction = SUTModule.translateSpeech; 
      speechTranslationServiceMock = vi.mocked(SUTModule.speechTranslationService, true);
      
      // speechTranslationServiceMock.translateSpeech is already a vi.fn() due to the top-level mock
      if (typeof speechTranslationServiceMock.translateSpeech.mockClear === 'function') {
        speechTranslationServiceMock.translateSpeech.mockClear().mockResolvedValue({
          originalText: 'translated by mock service',
          translatedText: 'legacy wrapper called service',
          audioBuffer: Buffer.from('mockaudio')
        });
      } else {
        // This path indicates a problem with the mock setup if translateSpeech is not a mock function
        console.error('Warning: speechTranslationServiceMock.translateSpeech is not a mock function in test setup.');
        // Fallback or throw if critical
        speechTranslationServiceMock.translateSpeech = vi.fn().mockResolvedValue({
            originalText: 'translated by mock service',
            translatedText: 'legacy wrapper called service',
            audioBuffer: Buffer.from('mockaudio')
        });
      }
    });

    it('should call speechTranslationService.translateSpeech with ttsServiceType as string', async () => {
      const audioBuffer = createMockAudioBuffer(100);
      await legacyTranslateSpeechFunction(audioBuffer, 'en', 'es', 'pre-text', 'openai');
      expect(speechTranslationServiceMock.translateSpeech).toHaveBeenCalledWith(
        audioBuffer,
        'en',
        'es',
        'pre-text',
        { ttsServiceType: 'openai' }
      );
    });

    it('should call speechTranslationService.translateSpeech with ttsServiceType as object', async () => {
      const audioBuffer = createMockAudioBuffer(100);
      const ttsOptions = { ttsServiceType: 'browser' };
      await legacyTranslateSpeechFunction(audioBuffer, 'en', 'de', 'pre-text-obj', ttsOptions);
      expect(speechTranslationServiceMock.translateSpeech).toHaveBeenCalledWith(
        audioBuffer,
        'en',
        'de',
        'pre-text-obj',
        ttsOptions
      );
    });

    it('should call speechTranslationService.translateSpeech with empty options if ttsServiceType is undefined', async () => {
      const audioBuffer = createMockAudioBuffer(100);
      await legacyTranslateSpeechFunction(audioBuffer, 'en', 'fr', 'pre-text-undef', undefined);
      expect(speechTranslationServiceMock.translateSpeech).toHaveBeenCalledWith(
        audioBuffer,
        'en',
        'fr',
        'pre-text-undef',
        {}
      );
  });
});

}); // End of main describe
