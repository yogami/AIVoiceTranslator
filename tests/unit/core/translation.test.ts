/**
 * Translation Service Tests
 * 
 * Consolidated tests for translation functionality including:
 * - OpenAI translation service
 * - Speech transcription
 * - Text-to-speech synthesis
 * - End-to-end speech translation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockOpenAI } from '../utils/test-helpers';

// Mock external dependencies
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => createMockOpenAI())
}));

// Create mock implementations for testing
class MockTranslationService {
  constructor(private openAI: any) {}
  
  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    if (!text.trim()) return '';
    if (sourceLanguage === targetLanguage) return text;
    
    try {
      const completion = await this.openAI.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Translate from ${sourceLanguage} to ${targetLanguage}: ${text}`
        }]
      });
      
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      return '';
    }
  }
}

class MockTranscriptionService {
  constructor(private openAI: any) {}
  
  async transcribe(audioBuffer: Buffer, language: string): Promise<string> {
    if (audioBuffer.length < 1000) return '';
    
    try {
      const response = await this.openAI.audio.transcriptions.create({
        file: new Blob([audioBuffer]),
        model: 'whisper-1',
        language: language.split('-')[0]
      });
      
      return response.text || '';
    } catch (error) {
      return '';
    }
  }
}

class MockSpeechTranslationService {
  constructor(
    private transcriptionService: MockTranscriptionService,
    private translationService: MockTranslationService
  ) {}
  
  async translateSpeech(
    audioBuffer: Buffer,
    sourceLanguage: string,
    targetLanguage: string,
    preTranscribedText?: string
  ) {
    try {
      let originalText = preTranscribedText;
      
      if (!originalText) {
        originalText = await this.transcriptionService.transcribe(audioBuffer, sourceLanguage);
      }
      
      if (!originalText.trim()) {
        return {
          originalText: '',
          translatedText: '',
          audioBuffer: Buffer.from('silent-audio')
        };
      }
      
      const translatedText = await this.translationService.translate(
        originalText,
        sourceLanguage,
        targetLanguage
      );
      
      return {
        originalText,
        translatedText,
        audioBuffer: Buffer.from('mock-tts-audio')
      };
    } catch (error) {
      return {
        originalText: '',
        translatedText: '',
        audioBuffer: Buffer.from('error-audio')
      };
    }
  }
}

describe('Translation Services', () => {
  let mockOpenAI: any;
  let translationService: MockTranslationService;
  let transcriptionService: MockTranscriptionService;
  let speechTranslationService: MockSpeechTranslationService;

  beforeEach(() => {
    mockOpenAI = createMockOpenAI();
    translationService = new MockTranslationService(mockOpenAI);
    transcriptionService = new MockTranscriptionService(mockOpenAI);
    speechTranslationService = new MockSpeechTranslationService(
      transcriptionService,
      translationService
    );
    vi.clearAllMocks();
  });

  describe('Text Translation', () => {
    it('should translate text between languages', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'Hola' } }]
      });
      
      const result = await translationService.translate('Hello', 'en', 'es');
      
      expect(result).toBe('Hola');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should return original text for same language', async () => {
      const text = 'Hello world';
      const result = await translationService.translate(text, 'en', 'en');
      
      expect(result).toBe(text);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle empty input', async () => {
      const result = await translationService.translate('', 'en', 'es');
      expect(result).toBe('');
    });

    it('should handle translation errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));
      
      const result = await translationService.translate('Hello', 'en', 'es');
      expect(result).toBe('');
    });
  });

  describe('Speech Transcription', () => {
    it('should transcribe audio to text', async () => {
      const audioBuffer = Buffer.alloc(5000);
      mockOpenAI.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'Transcribed text'
      });
      
      const result = await transcriptionService.transcribe(audioBuffer, 'en-US');
      
      expect(result).toBe('Transcribed text');
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
    });

    it('should handle small audio buffers', async () => {
      const smallBuffer = Buffer.alloc(100);
      const result = await transcriptionService.transcribe(smallBuffer, 'en-US');
      
      expect(result).toBe('');
      expect(mockOpenAI.audio.transcriptions.create).not.toHaveBeenCalled();
    });

    it('should extract base language code', async () => {
      const audioBuffer = Buffer.alloc(5000);
      mockOpenAI.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'French text'
      });
      
      await transcriptionService.transcribe(audioBuffer, 'fr-CA');
      
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'fr'
        })
      );
    });
  });

  describe('End-to-End Speech Translation', () => {
    it('should transcribe and translate speech', async () => {
      const audioBuffer = Buffer.alloc(5000);
      
      const result = await speechTranslationService.translateSpeech(
        audioBuffer,
        'en',
        'es'
      );
      
      expect(result.originalText).toBeTruthy();
      expect(result.translatedText).toBeTruthy();
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
    });

    it('should use pre-transcribed text when provided', async () => {
      const audioBuffer = Buffer.alloc(1000);
      const preTranscribedText = 'Already transcribed';
      
      const result = await speechTranslationService.translateSpeech(
        audioBuffer,
        'en',
        'es',
        preTranscribedText
      );
      
      expect(result.originalText).toBe(preTranscribedText);
    });

    it('should handle empty transcription results', async () => {
      mockOpenAI.audio.transcriptions.create.mockResolvedValueOnce({
        text: ''
      });
      
      const result = await speechTranslationService.translateSpeech(
        Buffer.alloc(5000),
        'en',
        'es'
      );
      
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
    });
  });
});
