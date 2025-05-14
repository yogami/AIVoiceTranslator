/**
 * Simplified and effective tests for TranslationService
 * 
 * This focuses on testing the public API in a way that works with ES modules
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock for OpenAI with separate functions to track
const mockTranscribe = vi.fn().mockResolvedValue({
  text: 'Mocked transcribed text'
});

const mockTranslate = vi.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: 'Mocked translated text'
      }
    }
  ]
});

// Mock OpenAI for ESM compatibility
vi.mock('openai', async () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: mockTranscribe
        }
      },
      chat: {
        completions: {
          create: mockTranslate
        }
      }
    }))
  };
});

// Mock TextToSpeechService
vi.mock('../../../server/services/TextToSpeechService', () => {
  return {
    textToSpeechService: {
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mocked audio data'))
    }
  };
});

// Mock fs for cache operations
vi.mock('fs/promises', async () => {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined)
  };
});

// Mock path with proper ESM support
vi.mock('path', async () => {
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
    resolve: vi.fn((...args) => args.join('/'))
  };
  
  return {
    default: mockPath,
    ...mockPath
  };
});

// Set environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('TranslationService Simplified Tests', () => {
  let translationModule: any;
  
  // Reset mocks before each test
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module
    translationModule = await import('../../../server/services/TranslationService');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Module Exports', () => {
    it('should export the speechTranslationService', () => {
      expect(translationModule.speechTranslationService).toBeDefined();
      expect(typeof translationModule.speechTranslationService.translateText).toBe('function');
      expect(typeof translationModule.speechTranslationService.transcribeAudio).toBe('function');
      expect(typeof translationModule.speechTranslationService.synthesizeSpeech).toBe('function');
      expect(typeof translationModule.speechTranslationService.translateSpeech).toBe('function');
    });
    
    it('should export the translateSpeech function', () => {
      expect(translationModule.translateSpeech).toBeDefined();
      expect(typeof translationModule.translateSpeech).toBe('function');
    });
  });
  
  describe('OpenAITranscriptionService', () => {
    it('should transcribe audio buffer to text', async () => {
      // Call the service through the exported speechTranslationService
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      const result = await translationModule.speechTranslationService.transcribeAudio(
        audioBuffer,
        language
      );
      
      // Check the result
      expect(result).toBe('Mocked transcribed text');
      
      // Verify OpenAI was called correctly
      expect(mockTranscribe).toHaveBeenCalled();
      
      // Verify buffer was included in the request
      const callArgs = mockTranscribe.mock.calls[0][0];
      expect(callArgs).toHaveProperty('file');
      expect(callArgs.model).toBe('whisper-1');
    });
    
    it('should handle empty audio buffer', async () => {
      const emptyBuffer = Buffer.from('');
      const language = 'en-US';
      
      const result = await translationModule.speechTranslationService.transcribeAudio(
        emptyBuffer,
        language
      );
      
      // Should return empty string
      expect(result).toBe('');
      
      // OpenAI should not be called for empty buffer
      expect(mockTranscribe).not.toHaveBeenCalled();
    });
  });
  
  describe('OpenAITranslationService', () => {
    it('should translate text between languages', async () => {
      const sourceText = 'Hello world';
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translationModule.speechTranslationService.translateText(
        sourceText,
        sourceLanguage,
        targetLanguage
      );
      
      // Check result
      expect(result).toBe('Mocked translated text');
      
      // Verify OpenAI was called correctly
      expect(mockTranslate).toHaveBeenCalledTimes(1);
      
      // Verify request parameters
      const callArgs = mockTranslate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4');
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
      expect(callArgs.messages[1].content).toContain(sourceText);
      expect(callArgs.messages[1].content).toContain(targetLanguage);
    });
    
    it('should handle empty text input', async () => {
      const result = await translationModule.speechTranslationService.translateText(
        '',
        'en-US',
        'fr-FR'
      );
      
      // Should return empty string
      expect(result).toBe('');
      
      // OpenAI should not be called
      expect(mockTranslate).not.toHaveBeenCalled();
    });
    
    it('should not translate when source and target languages are the same', async () => {
      const sourceText = 'Hello world';
      const language = 'en-US';
      
      const result = await translationModule.speechTranslationService.translateText(
        sourceText,
        language,
        language
      );
      
      // Should return the original text
      expect(result).toBe(sourceText);
      
      // OpenAI should not be called
      expect(mockTranslate).not.toHaveBeenCalled();
    });
  });
  
  describe('SpeechTranslationService', () => {
    it('should translate speech end-to-end', async () => {
      // Set up spies
      const transcribeSpy = vi.spyOn(translationModule.speechTranslationService, 'transcribeAudio');
      const translateSpy = vi.spyOn(translationModule.speechTranslationService, 'translateText');
      const synthesizeSpy = vi.spyOn(translationModule.speechTranslationService, 'synthesizeSpeech');
      
      // Configure return values
      transcribeSpy.mockResolvedValue('Transcribed text');
      translateSpy.mockResolvedValue('Translated text');
      synthesizeSpy.mockResolvedValue(Buffer.from('synthesized audio'));
      
      // Call the method
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translationModule.speechTranslationService.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify result structure
      expect(result).toHaveProperty('originalText');
      expect(result).toHaveProperty('translatedText');
      expect(result).toHaveProperty('audioBuffer');
      expect(result.originalText).toBe('Transcribed text');
      expect(result.translatedText).toBe('Translated text');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
      
      // Verify component calls were made correctly
      expect(transcribeSpy).toHaveBeenCalledWith(audioBuffer, sourceLanguage);
      expect(translateSpy).toHaveBeenCalledWith('Transcribed text', sourceLanguage, targetLanguage);
      expect(synthesizeSpy).toHaveBeenCalledWith('Translated text', targetLanguage);
    });
    
    it('should handle pre-transcribed text correctly', async () => {
      // Set up spies 
      const transcribeSpy = vi.spyOn(translationModule.speechTranslationService, 'transcribeAudio');
      const translateSpy = vi.spyOn(translationModule.speechTranslationService, 'translateText');
      const synthesizeSpy = vi.spyOn(translationModule.speechTranslationService, 'synthesizeSpeech');
      
      // Configure return values
      translateSpy.mockResolvedValue('Translated text');
      synthesizeSpy.mockResolvedValue(Buffer.from('synthesized audio'));
      
      // Call with pre-transcribed text
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      const preTranscribedText = 'Pre-transcribed text';
      
      const result = await translationModule.speechTranslationService.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Verify result
      expect(result.originalText).toBe(preTranscribedText);
      
      // Verify transcription was skipped
      expect(transcribeSpy).not.toHaveBeenCalled();
      
      // Verify translation and synthesis were performed
      expect(translateSpy).toHaveBeenCalledWith(preTranscribedText, sourceLanguage, targetLanguage);
      expect(synthesizeSpy).toHaveBeenCalled();
    });
    
    it('should handle empty audio buffer', async () => {
      const emptyBuffer = Buffer.from('');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translationModule.speechTranslationService.translateSpeech(
        emptyBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify empty result
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer.length).toBe(0);
    });
  });
  
  describe('translateSpeech function (main export)', () => {
    it('should delegate to speechTranslationService.translateSpeech', async () => {
      // Set up spy on the service method
      const serviceSpy = vi.spyOn(translationModule.speechTranslationService, 'translateSpeech');
      serviceSpy.mockResolvedValue({
        originalText: 'Original',
        translatedText: 'Translation',
        audioBuffer: Buffer.from('audio')
      });
      
      // Call the exported function
      const audioBuffer = Buffer.from('test audio');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translationModule.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify result
      expect(result).toEqual({
        originalText: 'Original',
        translatedText: 'Translation',
        audioBuffer: Buffer.from('audio')
      });
      
      // Verify the service method was called correctly
      expect(serviceSpy).toHaveBeenCalledWith(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        undefined
      );
    });
    
    it('should pass pre-transcribed text to the service', async () => {
      // Set up spy
      const serviceSpy = vi.spyOn(translationModule.speechTranslationService, 'translateSpeech');
      serviceSpy.mockResolvedValue({
        originalText: 'Pre-transcribed',
        translatedText: 'Translation',
        audioBuffer: Buffer.from('audio')
      });
      
      // Call with pre-transcribed text
      const audioBuffer = Buffer.from('test audio');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      const preTranscribedText = 'Pre-transcribed';
      
      await translationModule.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Verify the service was called with pre-transcribed text
      expect(serviceSpy).toHaveBeenCalledWith(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
    });
  });
});