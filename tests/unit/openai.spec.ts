import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateSpeech, TranslationResult } from '../../server/openai';

// Mock the TranslationService's translateSpeech function
vi.mock('../../server/services/TranslationService', () => ({
  translateSpeech: vi.fn()
}));

// Import the mocked function
import { translateSpeech as mockTranslateSpeechService } from '../../server/services/TranslationService';

describe('OpenAI Facade', () => {
  const mockAudioBuffer = Buffer.from('test audio data');
  const mockSourceLanguage = 'en-US';
  const mockTargetLanguage = 'es-ES';
  const mockPreTranscribedText = 'This is pre-transcribed text';
  
  // Sample translation result
  const mockTranslationResult: TranslationResult = {
    originalText: 'Original text',
    translatedText: 'Translated text',
    audioBuffer: Buffer.from('translated audio')
  };

  beforeEach(() => {
    // Set up the mock implementation
    vi.mocked(mockTranslateSpeechService).mockResolvedValue(mockTranslationResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly delegate to TranslationService.translateSpeech', async () => {
    // Act
    const result = await translateSpeech(
      mockAudioBuffer,
      mockSourceLanguage,
      mockTargetLanguage
    );

    // Assert
    expect(mockTranslateSpeechService).toHaveBeenCalledWith(
      mockAudioBuffer,
      mockSourceLanguage,
      mockTargetLanguage,
      undefined
    );
    expect(result).toEqual(mockTranslationResult);
  });

  it('should pass preTranscribedText when provided', async () => {
    // Act
    const result = await translateSpeech(
      mockAudioBuffer,
      mockSourceLanguage,
      mockTargetLanguage,
      mockPreTranscribedText
    );

    // Assert
    expect(mockTranslateSpeechService).toHaveBeenCalledWith(
      mockAudioBuffer,
      mockSourceLanguage,
      mockTargetLanguage,
      mockPreTranscribedText
    );
    expect(result).toEqual(mockTranslationResult);
  });

  it('should handle errors from TranslationService', async () => {
    // Arrange
    const mockError = new Error('Translation service error');
    vi.mocked(mockTranslateSpeechService).mockRejectedValueOnce(mockError);

    // Act and Assert
    await expect(translateSpeech(
      mockAudioBuffer,
      mockSourceLanguage,
      mockTargetLanguage
    )).rejects.toThrow('Translation service error');
  });
});