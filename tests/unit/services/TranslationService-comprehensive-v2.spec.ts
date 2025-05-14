/**
 * Comprehensive tests for the TranslationService module
 * Version 2 with more comprehensive coverage of all classes and methods
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Mock external modules but NOT the SUT (System Under Test)
vi.mock('openai', async () => {
  const createTranscriptionMock = vi.fn().mockResolvedValue({
    text: 'Mocked transcribed text'
  });
  
  const createChatCompletionMock = vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: 'Mocked translated text'
        }
      }
    ]
  });
  
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: createTranscriptionMock
        },
        speech: {
          create: vi.fn().mockResolvedValue(Buffer.from('mocked audio data'))
        }
      },
      chat: {
        completions: {
          create: createChatCompletionMock
        }
      }
    }))
  };
});

// Mock fs with basic implementation
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
  access: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

// Mock path with basic implementation
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

// Set up environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('TranslationService Comprehensive Tests v2', () => {
  // Store references to imported modules
  let translationModule: any;
  let TranscriptionService: any;
  let TranslationService: any;
  let SpeechTranslationService: any;
  let translateSpeech: any;
  
  // Store instances
  let transcriptionService: any;
  let translationService: any;
  let speechTranslationService: any;
  
  // Setup before each test
  beforeEach(async () => {
    // Clear mocks
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module
    translationModule = await import('../../../server/services/TranslationService');
    
    // Get class references
    TranscriptionService = translationModule.OpenAITranscriptionService;
    TranslationService = translationModule.OpenAITranslationService;
    SpeechTranslationService = translationModule.SpeechTranslationService;
    translateSpeech = translationModule.translateSpeech;
    
    // Create instances
    transcriptionService = new TranscriptionService();
    translationService = new TranslationService();
    speechTranslationService = translationModule.speechTranslationService;
  });
  
  // Clean up after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('OpenAITranscriptionService', () => {
    it('should initialize with an OpenAI client', () => {
      expect(transcriptionService).toBeDefined();
      // Verify that the OpenAI client is created
      const openai = require('openai');
      expect(openai.default).toHaveBeenCalled();
    });
    
    it('should transcribe audio data correctly', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const result = await transcriptionService.transcribeAudio(audioBuffer, 'en-US');
      
      // Verify the result
      expect(result).toBe('Mocked transcribed text');
      
      // Verify the OpenAI client was called
      const openai = require('openai');
      const mockClient = openai.default.mock.results[0].value;
      expect(mockClient.audio.transcriptions.create).toHaveBeenCalled();
      
      // Verify the correct parameters were passed
      const callArgs = mockClient.audio.transcriptions.create.mock.calls[0][0];
      expect(callArgs).toHaveProperty('file');
      expect(callArgs.model).toBe('whisper-1');
      expect(callArgs.language).toBe('en');
    });
    
    it('should handle empty audio buffer correctly', async () => {
      const audioBuffer = Buffer.from('');
      const result = await transcriptionService.transcribeAudio(audioBuffer, 'en-US');
      
      // Should return empty string for empty buffer
      expect(result).toBe('');
      
      // OpenAI should not be called for empty buffer
      const openai = require('openai');
      const mockClient = openai.default.mock.results[0].value;
      expect(mockClient.audio.transcriptions.create).not.toHaveBeenCalled();
    });
    
    it('should extract the base language code correctly', () => {
      // Test with different language code formats
      expect(transcriptionService.getBaseLanguageCode('en-US')).toBe('en');
      expect(transcriptionService.getBaseLanguageCode('fr-FR')).toBe('fr');
      expect(transcriptionService.getBaseLanguageCode('es')).toBe('es');
      expect(transcriptionService.getBaseLanguageCode('zh-CN')).toBe('zh');
    });
    
    it('should handle transcription errors gracefully', async () => {
      // Mock the OpenAI client to throw an error
      const openai = require('openai');
      const mockClient = openai.default.mock.results[0].value;
      mockClient.audio.transcriptions.create.mockRejectedValueOnce(new Error('API error'));
      
      // Call the method
      const audioBuffer = Buffer.from('test audio data');
      
      // Should return empty string on error
      const result = await transcriptionService.transcribeAudio(audioBuffer, 'en-US');
      expect(result).toBe('');
    });
  });
  
  describe('OpenAITranslationService', () => {
    it('should initialize with an OpenAI client', () => {
      expect(translationService).toBeDefined();
      // Verify that the OpenAI client is created
      const openai = require('openai');
      expect(openai.default).toHaveBeenCalled();
    });
    
    it('should translate text correctly', async () => {
      const inputText = 'Hello world';
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translationService.translateText(
        inputText,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify the result
      expect(result).toBe('Mocked translated text');
      
      // Verify the OpenAI client was called
      const openai = require('openai');
      const mockClient = openai.default.mock.results[0].value;
      expect(mockClient.chat.completions.create).toHaveBeenCalled();
      
      // Verify the correct parameters were passed
      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4');
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
      expect(callArgs.messages[1].content).toContain(inputText);
      expect(callArgs.messages[1].content).toContain(targetLanguage);
    });
    
    it('should handle empty text correctly', async () => {
      const inputText = '';
      const sourceLanguage = 'en-US';
      const targetLanguage = 'fr-FR';
      
      const result = await translationService.translateText(
        inputText,
        sourceLanguage,
        targetLanguage
      );
      
      // Should return empty string for empty text
      expect(result).toBe('');
      
      // OpenAI should not be called for empty text
      const openai = require('openai');
      const mockClient = openai.default.mock.results[0].value;
      expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
    });
    
    it('should handle same source and target language', async () => {
      const inputText = 'Hello world';
      const language = 'en-US';
      
      const result = await translationService.translateText(
        inputText,
        language,
        language
      );
      
      // Should return original text for same language
      expect(result).toBe(inputText);
      
      // OpenAI should not be called for same language
      const openai = require('openai');
      const mockClient = openai.default.mock.results[0].value;
      expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
    });
    
    it('should handle translation errors gracefully', async () => {
      // Mock the OpenAI client to throw an error
      const openai = require('openai');
      const mockClient = openai.default.mock.results[0].value;
      mockClient.chat.completions.create.mockRejectedValueOnce(new Error('API error'));
      
      // Call the method
      const inputText = 'Hello world';
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      // Should return empty string on error
      const result = await translationService.translateText(
        inputText,
        sourceLanguage,
        targetLanguage
      );
      
      expect(result).toBe('');
    });
  });
  
  describe('SpeechTranslationService', () => {
    it('should integrate transcription and translation services', async () => {
      // Set up spies
      const transcribeSpy = vi.spyOn(speechTranslationService, 'transcribeAudio');
      const translateSpy = vi.spyOn(speechTranslationService, 'translateText');
      const synthesizeSpy = vi.spyOn(speechTranslationService, 'synthesizeSpeech');
      
      // Mock return values
      transcribeSpy.mockResolvedValue('Mocked transcribed text');
      translateSpy.mockResolvedValue('Mocked translated text');
      synthesizeSpy.mockResolvedValue(Buffer.from('mocked speech audio'));
      
      // Call the method
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await speechTranslationService.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify the result
      expect(result).toHaveProperty('originalText');
      expect(result).toHaveProperty('translatedText');
      expect(result).toHaveProperty('audioBuffer');
      expect(result.originalText).toBe('Mocked transcribed text');
      expect(result.translatedText).toBe('Mocked translated text');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
      
      // Verify the methods were called
      expect(transcribeSpy).toHaveBeenCalledWith(audioBuffer, sourceLanguage);
      expect(translateSpy).toHaveBeenCalledWith(
        'Mocked transcribed text',
        sourceLanguage,
        targetLanguage
      );
      expect(synthesizeSpy).toHaveBeenCalledWith('Mocked translated text', targetLanguage);
    });
    
    it('should handle pre-transcribed text correctly', async () => {
      // Set up spies
      const transcribeSpy = vi.spyOn(speechTranslationService, 'transcribeAudio');
      const translateSpy = vi.spyOn(speechTranslationService, 'translateText');
      const synthesizeSpy = vi.spyOn(speechTranslationService, 'synthesizeSpeech');
      
      // Mock return values
      translateSpy.mockResolvedValue('Mocked translated text');
      synthesizeSpy.mockResolvedValue(Buffer.from('mocked speech audio'));
      
      // Call the method with pre-transcribed text
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'fr-FR';
      const preTranscribedText = 'Pre-transcribed text';
      
      const result = await speechTranslationService.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Verify the result
      expect(result.originalText).toBe(preTranscribedText);
      expect(result.translatedText).toBe('Mocked translated text');
      
      // Verify transcription was NOT called
      expect(transcribeSpy).not.toHaveBeenCalled();
      
      // Verify translation and synthesis were called
      expect(translateSpy).toHaveBeenCalledWith(
        preTranscribedText,
        sourceLanguage,
        targetLanguage
      );
      expect(synthesizeSpy).toHaveBeenCalledWith('Mocked translated text', targetLanguage);
    });
    
    it('should handle empty audio buffer correctly', async () => {
      // Call the method with empty audio buffer
      const audioBuffer = Buffer.from('');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await speechTranslationService.translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify the result
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer.length).toBe(0);
    });
    
    it('should use correct TTS service based on configuration', async () => {
      // Mock ttsServiceType to test different TTS services
      const originalTtsType = speechTranslationService.ttsServiceType;
      
      try {
        // Test with 'silent' TTS service
        speechTranslationService.ttsServiceType = 'silent';
        
        const result1 = await speechTranslationService.synthesizeSpeech('Test text', 'en-US');
        expect(Buffer.isBuffer(result1)).toBe(true);
        
        // Test with 'openai' TTS service
        speechTranslationService.ttsServiceType = 'openai';
        
        const result2 = await speechTranslationService.synthesizeSpeech('Test text', 'fr-FR');
        expect(Buffer.isBuffer(result2)).toBe(true);
      } finally {
        // Restore original value
        speechTranslationService.ttsServiceType = originalTtsType;
      }
    });
  });
  
  describe('translateSpeech function (main export)', () => {
    it('should call the SpeechTranslationService.translateSpeech method', async () => {
      // Set up spy
      const translateSpeechSpy = vi.spyOn(speechTranslationService, 'translateSpeech');
      translateSpeechSpy.mockResolvedValue({
        originalText: 'Mocked original',
        translatedText: 'Mocked translation',
        audioBuffer: Buffer.from('mocked audio')
      });
      
      // Call the function
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      
      const result = await translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage
      );
      
      // Verify the result
      expect(result).toHaveProperty('originalText');
      expect(result).toHaveProperty('translatedText');
      expect(result).toHaveProperty('audioBuffer');
      
      // Verify the service method was called
      expect(translateSpeechSpy).toHaveBeenCalledWith(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        undefined
      );
    });
    
    it('should pass pre-transcribed text correctly', async () => {
      // Set up spy
      const translateSpeechSpy = vi.spyOn(speechTranslationService, 'translateSpeech');
      translateSpeechSpy.mockResolvedValue({
        originalText: 'Pre-transcribed text',
        translatedText: 'Mocked translation',
        audioBuffer: Buffer.from('mocked audio')
      });
      
      // Call the function with pre-transcribed text
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'fr-FR';
      const preTranscribedText = 'Pre-transcribed text';
      
      const result = await translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Verify the service method was called with pre-transcribed text
      expect(translateSpeechSpy).toHaveBeenCalledWith(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
    });
  });
});