/**
 * Comprehensive tests for TranslationService
 *
 * These tests verify all aspects of the TranslationService functionality,
 * including error handling, caching, and different translation scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI with default export pattern
vi.mock('openai', async (importOriginal) => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'Mock transcribed text',
        }),
      },
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Mock translated text',
              },
            },
          ],
        }),
      },
    },
  }));
  
  return {
    default: MockOpenAI
  };
});

// Mock the TextToSpeechService
vi.mock('../../../server/services/TextToSpeechService', () => {
  return {
    textToSpeechService: {
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio data'))
    },
    ttsFactory: {
      getService: vi.fn().mockReturnValue({
        synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio data'))
      })
    }
  };
});

// Mock path, url, util
vi.mock('path', async (importOriginal) => {
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn(path => path.substring(0, path.lastIndexOf('/')) || '/'),
    resolve: vi.fn((...args) => args.join('/'))
  };
  
  return {
    default: mockPath,
    ...mockPath
  };
});

vi.mock('url', async (importOriginal) => {
  const mockUrl = {
    fileURLToPath: vi.fn((url) => '/mocked/file/path')
  };
  
  return {
    default: mockUrl,
    ...mockUrl
  };
});

vi.mock('util', async (importOriginal) => {
  const mockUtil = {
    promisify: vi.fn(fn => fn)
  };
  
  return {
    default: mockUtil,
    ...mockUtil
  };
});

// Mock fs with default export pattern
vi.mock('fs', async (importOriginal) => {
  const mockFs = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    access: vi.fn().mockResolvedValue(undefined)
  };
  
  return {
    promises: mockFs,
    default: {
      promises: mockFs
    }
  };
});

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('TranslationService Comprehensive Tests', () => {
  let speechTranslationService: any;
  let translateSpeechFn: any;
  let openaiMock: any;
  let textToSpeechMock: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module
    const translation = await import('../../../server/services/TranslationService');
    speechTranslationService = translation.speechTranslationService;
    translateSpeechFn = translation.translateSpeech;
    
    // Get references to mocks
    const openai = await import('openai');
    openaiMock = openai.default;
    
    const tts = await import('../../../server/services/TextToSpeechService');
    textToSpeechMock = tts.textToSpeechService.synthesizeSpeech;
  });
  
  describe('translateText function', () => {
    it('should translate text with default parameters', async () => {
      const result = await speechTranslationService.translateText(
        'Hello world',
        'en-US',
        'es-ES'
      );
      
      // Verify result
      expect(result).toBe('Mock translated text');
      
      // Verify OpenAI was called
      const openaiInstance = openaiMock.mock.results[0].value;
      expect(openaiInstance.chat.completions.create).toHaveBeenCalled();
    });
    
    it('should handle empty text', async () => {
      const result = await speechTranslationService.translateText(
        '',
        'en-US',
        'fr-FR'
      );
      
      // Should handle empty text gracefully
      expect(result).toBe('');
      
      // OpenAI should not be called for empty text
      const openaiInstance = openaiMock.mock.results[0].value;
      expect(openaiInstance.chat.completions.create).not.toHaveBeenCalled();
    });
  });
  
  describe('transcribeAudio function', () => {
    it('should transcribe audio buffer', async () => {
      const audioBuffer = Buffer.from('test audio data');
      
      const result = await speechTranslationService.transcribeAudio(
        audioBuffer,
        'en-US'
      );
      
      // Verify result
      expect(result).toBe('Mock transcribed text');
      
      // Verify OpenAI was called
      const openaiInstance = openaiMock.mock.results[0].value;
      expect(openaiInstance.audio.transcriptions.create).toHaveBeenCalled();
    });
    
    it('should handle empty audio buffer', async () => {
      const audioBuffer = Buffer.from('');
      
      const result = await speechTranslationService.transcribeAudio(
        audioBuffer,
        'en-US'
      );
      
      // Should return empty string for empty buffer
      expect(result).toBe('');
      
      // OpenAI should not be called for empty buffer
      const openaiInstance = openaiMock.mock.results[0].value;
      expect(openaiInstance.audio.transcriptions.create).not.toHaveBeenCalled();
    });
  });
  
  describe('synthesizeSpeech function', () => {
    it('should generate speech from text', async () => {
      const text = 'Hello, this is test speech';
      const language = 'en-US';
      
      const result = await speechTranslationService.synthesizeSpeech(text, language);
      
      // Verify result is a buffer
      expect(Buffer.isBuffer(result)).toBe(true);
      
      // Verify TTS service was called
      expect(textToSpeechMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: text
        })
      );
    });
    
    it('should handle empty text', async () => {
      const result = await speechTranslationService.synthesizeSpeech('', 'fr-FR');
      
      // Should return an empty buffer
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0);
      
      // TTS service should not be called for empty text
      expect(textToSpeechMock).not.toHaveBeenCalled();
    });
  });
  
  describe('translateSpeech function', () => {
    it('should translate speech end-to-end', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translateSpeechFn(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify the result structure
      expect(result).toHaveProperty('originalText');
      expect(result).toHaveProperty('translatedText');
      expect(result).toHaveProperty('audioBuffer');
      
      // Check that all the appropriate services were called
      const openaiInstance = openaiMock.mock.results[0].value;
      expect(openaiInstance.audio.transcriptions.create).toHaveBeenCalled();
      expect(openaiInstance.chat.completions.create).toHaveBeenCalled();
      expect(textToSpeechMock).toHaveBeenCalled();
    });
    
    it('should handle pre-transcribed text', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'de-DE';
      const preTranscribedText = 'Pre-transcribed text';
      
      const result = await translateSpeechFn(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Verify the result
      expect(result.originalText).toBe(preTranscribedText);
      
      // OpenAI transcription should not be called
      const openaiInstance = openaiMock.mock.results[0].value;
      expect(openaiInstance.audio.transcriptions.create).not.toHaveBeenCalled();
      
      // But translation and TTS should be called
      expect(openaiInstance.chat.completions.create).toHaveBeenCalled();
      expect(textToSpeechMock).toHaveBeenCalled();
    });
    
    it('should handle same source and target language', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const language = 'fr-FR';
      
      const result = await translateSpeechFn(
        audioBuffer,
        language,
        language // Same language
      );
      
      // Should transcribe but not translate
      expect(result.originalText).toBe('Mock transcribed text');
      expect(result.translatedText).toBe('Mock transcribed text');
      
      // OpenAI translation should not be called
      const openaiInstance = openaiMock.mock.results[0].value;
      expect(openaiInstance.chat.completions.create).not.toHaveBeenCalled();
    });
  });
});