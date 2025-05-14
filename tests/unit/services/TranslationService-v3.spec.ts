/**
 * Simplified TranslationService tests that work with ES modules
 * This focuses on testing the main exported functions directly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';

// Mock OpenAI
const mockOpenAIClient = {
  audio: {
    transcriptions: {
      create: vi.fn().mockResolvedValue({
        text: 'Mocked transcribed text'
      })
    },
    speech: {
      create: vi.fn().mockResolvedValue(Buffer.from('mocked audio data'))
    }
  },
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Mocked translated text'
            }
          }
        ]
      })
    }
  }
};

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => mockOpenAIClient)
  };
});

// Mock fs
vi.mock('fs/promises', () => {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined)
  };
});

// Mock path to avoid ESM issues
vi.mock('path', () => {
  return {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
    resolve: vi.fn((...args) => args.join('/')),
    default: {
      join: vi.fn((...args) => args.join('/')),
      dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
      resolve: vi.fn((...args) => args.join('/'))
    }
  };
});

// Mock url to avoid ESM issues
vi.mock('url', () => {
  return {
    fileURLToPath: vi.fn((url) => 'mocked/file/path'),
    default: {
      fileURLToPath: vi.fn((url) => 'mocked/file/path')
    }
  };
});

// Set environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('TranslationService functionality', () => {
  let translationService: any;
  
  // Reset mocks between tests
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module after resetting mocks
    const translationModule = await import('../../../server/services/TranslationService');
    
    // Get the exported speechTranslationService
    translationService = translationModule.speechTranslationService;
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Core translation functions', () => {
    it('should properly transcribe audio', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      const result = await translationService.transcribeAudio(audioBuffer, language);
      
      // Check result
      expect(result).toBe('Mocked transcribed text');
      
      // Verify OpenAI was called correctly
      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAIClient.audio.transcriptions.create.mock.calls[0][0]).toMatchObject({
        model: 'whisper-1',
        language: 'en' // Base language code
      });
    });
    
    it('should translate text between languages', async () => {
      const text = 'Hello world';
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translationService.translateText(text, sourceLanguage, targetLanguage);
      
      // Check result
      expect(result).toBe('Mocked translated text');
      
      // Verify OpenAI was called correctly
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(1);
      
      const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
      expect(callArgs.messages[1].content).toContain(text);
      expect(callArgs.messages[1].content).toContain(targetLanguage);
    });
    
    it('should skip translation when source and target languages are the same', async () => {
      const text = 'Hello world';
      const language = 'en-US';
      
      const result = await translationService.translateText(text, language, language);
      
      // Should return the original text
      expect(result).toBe(text);
      
      // Should not call OpenAI
      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled();
    });
    
    it('should convert text to speech', async () => {
      const text = 'Hello world';
      const language = 'en-US';
      
      const result = await translationService.synthesizeSpeech(text, language);
      
      // Should return a buffer
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
  
  describe('End-to-end speech translation', () => {
    it('should translate speech from one language to another', async () => {
      // Create spy for component functions
      const transcribeSpy = vi.spyOn(translationService, 'transcribeAudio');
      const translateSpy = vi.spyOn(translationService, 'translateText');
      const synthesizeSpy = vi.spyOn(translationService, 'synthesizeSpeech');
      
      // Configure return values
      transcribeSpy.mockResolvedValue('Transcribed text');
      translateSpy.mockResolvedValue('Translated text');
      synthesizeSpy.mockResolvedValue(Buffer.from('synthesized speech'));
      
      // Execute the full flow
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'fr-FR';
      
      const result = await translationService.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify the result structure
      expect(result).toHaveProperty('originalText');
      expect(result).toHaveProperty('translatedText');
      expect(result).toHaveProperty('audioBuffer');
      
      // Check component function calls
      expect(transcribeSpy).toHaveBeenCalledWith(audioBuffer, sourceLanguage);
      expect(translateSpy).toHaveBeenCalledWith('Transcribed text', sourceLanguage, targetLanguage);
      expect(synthesizeSpy).toHaveBeenCalledWith('Translated text', targetLanguage);
    });
    
    it('should use pre-transcribed text when provided', async () => {
      // Create spy for component functions
      const transcribeSpy = vi.spyOn(translationService, 'transcribeAudio');
      const translateSpy = vi.spyOn(translationService, 'translateText');
      const synthesizeSpy = vi.spyOn(translationService, 'synthesizeSpeech');
      
      // Configure return values
      translateSpy.mockResolvedValue('Translated text');
      synthesizeSpy.mockResolvedValue(Buffer.from('synthesized speech'));
      
      // Execute with pre-transcribed text
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      const preTranscribedText = 'Pre-transcribed text';
      
      const result = await translationService.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Verify transcription is skipped
      expect(transcribeSpy).not.toHaveBeenCalled();
      
      // Verify pre-transcribed text is used
      expect(result.originalText).toBe(preTranscribedText);
      expect(translateSpy).toHaveBeenCalledWith(preTranscribedText, sourceLanguage, targetLanguage);
    });
    
    it('should handle empty audio buffers', async () => {
      const emptyBuffer = Buffer.from('');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'fr-FR';
      
      const result = await translationService.translateSpeech(
        emptyBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Should have empty strings and buffer
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer.length).toBe(0);
    });
  });
  
  describe('Error handling', () => {
    it('should handle transcription errors gracefully', async () => {
      // Make transcription throw an error
      mockOpenAIClient.audio.transcriptions.create.mockRejectedValueOnce(
        new Error('Transcription failed')
      );
      
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      // Should return empty string on error
      const result = await translationService.transcribeAudio(audioBuffer, language);
      expect(result).toBe('');
    });
    
    it('should handle translation errors gracefully', async () => {
      // Make translation throw an error
      mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(
        new Error('Translation failed')
      );
      
      const text = 'Test text';
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      // Should return empty string on error
      const result = await translationService.translateText(text, sourceLanguage, targetLanguage);
      expect(result).toBe('');
    });
  });
});