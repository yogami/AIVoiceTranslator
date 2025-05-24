/**
 * Test helpers specifically for Translation Service tests
 */

import { vi, beforeEach, afterEach, expect, Mock } from 'vitest';
import { createMockOpenAI } from '../utils/test-helpers';
import { 
  ITranscriptionService, 
  ITranslationService, 
  OpenAITranslationService,
  SpeechTranslationService 
} from '../../../server/services/TranslationService';
import OpenAI from 'openai';

/**
 * Creates mock transcription and translation services for testing
 */
export function createMockTranslationServices() {
  return {
    mockTranscriptionService: {
      transcribe: vi.fn().mockImplementation(async () => '')
    } as ITranscriptionService,
    mockTranslationService: {
      translate: vi.fn().mockImplementation(async () => '')
    } as ITranslationService
  };
}

/**
 * Sets up console spies for translation service tests
 */
export function setupConsoleMocks() {
  return {
    consoleLogSpy: vi.spyOn(console, 'log').mockImplementation(() => {}),
    consoleErrorSpy: vi.spyOn(console, 'error').mockImplementation(() => {})
  };
}

/**
 * Mocks the TextToSpeechService 
 * Important: This creates mock for the import, not for the actual service implementation
 */
export function setupTextToSpeechMock() {
  // Mock the import but not the actual service implementation
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
}

/**
 * Sets up OpenAI translation service tests
 */
export function setupOpenAITranslationTest() {
  let service: ITranslationService;
  let mockOpenAI: OpenAI = createMockOpenAI();

  beforeEach(() => {
    vi.useFakeTimers();
    service = new OpenAITranslationService(mockOpenAI);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  return { mockOpenAI, getService: () => service };
}

/**
 * Creates a standard test case for the translateSpeech method
 */
export function createTranslateSpeechTest({
  audioBuffer,
  sourceLang,
  targetLang,
  transcribedText,
  translatedText,
  mockTranscriptionService,
  mockTranslationService,
  ttsOptions
}: {
  audioBuffer: Buffer;
  sourceLang: string;
  targetLang: string;
  transcribedText: string;
  translatedText: string;
  mockTranscriptionService: ITranscriptionService;
  mockTranslationService: ITranslationService;
  ttsOptions?: any;
}) {
  return async () => {
    ((mockTranscriptionService.transcribe as unknown) as Mock).mockResolvedValue(transcribedText);
    ((mockTranslationService.translate as unknown) as Mock).mockResolvedValue(translatedText);

    const service = new SpeechTranslationService(
      mockTranscriptionService,
      mockTranslationService,
      true // apiKeyAvailable = true
    );

    const result = await service.translateSpeech(audioBuffer, sourceLang, targetLang, undefined, ttsOptions);

    expect(mockTranscriptionService.transcribe).toHaveBeenCalledWith(audioBuffer, sourceLang);
    expect(mockTranslationService.translate).toHaveBeenCalledWith(transcribedText, sourceLang, targetLang);
    expect(result.originalText).toBe(transcribedText);
    expect(result.translatedText).toBe(translatedText);
    expect(result.audioBuffer).toBeInstanceOf(Buffer);

    return result;
  };
}