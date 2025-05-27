/**
 * Speech Translation Service Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechTranslationService } from '../../../server/services/TranslationService';
import { createMockAudioBuffer, setupConsoleMocks } from '../utils/test-helpers';

// Mock the TextToSpeechService
vi.mock('../../../server/services/textToSpeech/TextToSpeechService', () => ({
  ttsFactory: {
    getService: vi.fn().mockReturnValue({
      synthesizeSpeech: vi.fn().mockImplementation(async () => Buffer.from('mock-audio-buffer'))
    })
  }
}));

describe('SpeechTranslationService', () => {
  const { consoleLogSpy, consoleErrorSpy } = setupConsoleMocks();
  let service: SpeechTranslationService;
  let mockTranscriptionService: any;
  let mockTranslationService: any;

  beforeEach(() => {
    // Create mock services
    mockTranscriptionService = {
      transcribe: vi.fn().mockResolvedValue('Transcribed text')
    };
    
    mockTranslationService = {
      translate: vi.fn().mockResolvedValue('Translated text')
    };
    
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
});