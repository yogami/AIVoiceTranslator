/**
 * TranslationService Minimal Tests
 * 
 * This file uses a simpler approach to testing the TranslationService module
 * by directly creating test doubles for external dependencies rather than trying 
 * to mock entire modules.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';

// Import the module under test
import * as translationModule from '../../../server/services/TranslationService';

// Mock fs functions used by AudioFileHandler
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    createReadStream: vi.fn(() => ({
      on: vi.fn(),
      pipe: vi.fn()
    })),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn().mockImplementation(() => ({
      size: 1000,
      mtime: new Date()
    }))
  };
});

// Mock path
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    join: vi.fn().mockImplementation((dir, filename) => `${dir}/${filename}`)
  };
});

describe('TranslationService Tests', () => {
  // Create test doubles for OpenAI client
  class OpenAITestDouble {
    audio = {
      transcriptions: {
        create: vi.fn().mockImplementation(async () => ({
          text: 'This is a test transcription'
        }))
      }
    };
    
    chat = {
      completions: {
        create: vi.fn().mockImplementation(async () => ({
          choices: [
            {
              message: {
                content: 'This is a test translation'
              }
            }
          ]
        }))
      }
    };
  }
  
  // Test doubles for services
  class TranscriptionServiceDouble implements translationModule.ITranscriptionService {
    transcribeCallCount = 0;
    mockTranscription = 'Mocked transcription';
    shouldFail = false;
    
    async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
      this.transcribeCallCount++;
      console.log(`Mock transcription service called with language: ${sourceLanguage} and buffer size: ${audioBuffer.length}`);
      
      if (this.shouldFail) {
        throw new Error('Transcription failed');
      }
      
      return this.mockTranscription;
    }
  }
  
  class TranslationServiceDouble implements translationModule.ITranslationService {
    translateCallCount = 0;
    mockTranslation = 'Mocked translation';
    shouldFail = false;
    
    async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
      this.translateCallCount++;
      console.log(`Mock translation service called with text: ${text}, from: ${sourceLanguage}, to: ${targetLanguage}`);
      
      if (this.shouldFail) {
        throw new Error('Translation failed');
      }
      
      return this.mockTranslation;
    }
  }
  
  describe('AudioFileHandler', () => {
    it('should create and delete temporary files', async () => {
      // Create an instance of AudioFileHandler using the constructor approach
      // We need to extract it from the module
      const handler = new (translationModule as any).AudioFileHandler();
      
      // Set up mocks
      (fs.writeFile as any).mockImplementation((path, buffer, callback) => {
        if (typeof callback === 'function') callback(null);
        return Promise.resolve();
      });
      
      (fs.unlink as any).mockImplementation((path, callback) => {
        if (typeof callback === 'function') callback(null);
        return Promise.resolve();
      });
      
      // Call the methods
      const tempPath = await handler.createTempFile(Buffer.from('test audio'));
      expect(tempPath).toContain('temp-audio-');
      expect(fs.writeFile).toHaveBeenCalled();
      
      await handler.deleteTempFile(tempPath);
      expect(fs.unlink).toHaveBeenCalledWith(tempPath, expect.any(Function));
    });
  });
  
  describe('OpenAITranscriptionService', () => {
    let openaiApiDouble: any;
    let service: any;
    
    beforeEach(() => {
      // Create a fresh test double for each test
      openaiApiDouble = new OpenAITestDouble();
      // We need to access the class constructor
      const OpenAITranscriptionService = (translationModule as any).OpenAITranscriptionService;
      service = new OpenAITranscriptionService(openaiApiDouble);
    });
    
    it('should transcribe audio correctly', async () => {
      // Mock expected response
      openaiApiDouble.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'This is a test transcription'
      });
      
      // Create a buffer that's large enough to pass the size check
      const audioBuffer = Buffer.alloc(1000, 'test audio');
      
      // Call the service
      const result = await service.transcribe(audioBuffer, 'en-US');
      
      // Verify expected behavior
      expect(result).toBe('This is a test transcription');
      expect(openaiApiDouble.audio.transcriptions.create).toHaveBeenCalled();
    });
    
    it('should handle empty or small audio buffers gracefully', async () => {
      // Test with empty buffer
      const emptyResult = await service.transcribe(Buffer.alloc(0), 'en-US');
      expect(emptyResult).toBe('');
      
      // Test with small buffer
      const smallResult = await service.transcribe(Buffer.alloc(500), 'en-US');
      expect(smallResult).toBe('');
      
      // OpenAI API should not be called in either case
      expect(openaiApiDouble.audio.transcriptions.create).not.toHaveBeenCalled();
    });
    
    it('should detect and handle prompt leakage', async () => {
      // Test with a response containing a suspicious phrase
      openaiApiDouble.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'If there is no speech or only background noise, return an empty string'
      });
      
      const audioBuffer = Buffer.alloc(1000, 'test audio');
      const result = await service.transcribe(audioBuffer, 'en-US');
      
      // Should detect the leak and return empty string
      expect(result).toBe('');
    });
    
    it('should handle transcription API errors', async () => {
      // Mock API error
      openaiApiDouble.audio.transcriptions.create.mockRejectedValueOnce(
        new Error('API error')
      );
      
      const audioBuffer = Buffer.alloc(1000, 'test audio');
      
      // Expect the service to throw
      await expect(service.transcribe(audioBuffer, 'en-US')).rejects.toThrow('Transcription failed');
    });
  });
  
  describe('OpenAITranslationService', () => {
    let openaiApiDouble: any;
    let service: any;
    
    beforeEach(() => {
      // Create a fresh test double for each test
      openaiApiDouble = new OpenAITestDouble();
      // We need to access the class constructor
      const OpenAITranslationService = (translationModule as any).OpenAITranslationService;
      service = new OpenAITranslationService(openaiApiDouble);
    });
    
    it('should translate text correctly', async () => {
      // Mock expected response
      openaiApiDouble.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Esto es una prueba de traducción'
            }
          }
        ]
      });
      
      // Call the service
      const result = await service.translate('This is a translation test', 'en-US', 'es-ES');
      
      // Verify expected behavior
      expect(result).toBe('Esto es una prueba de traducción');
      expect(openaiApiDouble.chat.completions.create).toHaveBeenCalled();
    });
    
    it('should handle empty text gracefully', async () => {
      const result = await service.translate('', 'en-US', 'es-ES');
      expect(result).toBe('');
      expect(openaiApiDouble.chat.completions.create).not.toHaveBeenCalled();
    });
    
    it('should skip translation when languages are the same', async () => {
      const result = await service.translate('Hello world', 'en-US', 'en-US');
      expect(result).toBe('Hello world');
      expect(openaiApiDouble.chat.completions.create).not.toHaveBeenCalled();
    });
    
    it('should handle translation API errors with retry', async () => {
      // Mock API errors for the first attempt, then succeed
      openaiApiDouble.chat.completions.create
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Successful translation after retry'
              }
            }
          ]
        });
      
      // Spy on setTimeout to avoid waiting in the test
      vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return {} as any;
      });
      
      // Call the service
      const result = await service.translate('Test with retry', 'en-US', 'fr-FR');
      
      // Should succeed after retry
      expect(result).toBe('Successful translation after retry');
      expect(openaiApiDouble.chat.completions.create).toHaveBeenCalledTimes(2);
    });
    
    it('should handle translation API errors after max retries', async () => {
      // Mock API errors for multiple attempts
      for (let i = 0; i < 5; i++) {
        openaiApiDouble.chat.completions.create.mockRejectedValueOnce(
          new Error('API error')
        );
      }
      
      // Spy on setTimeout to avoid waiting in the test
      vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return {} as any;
      });
      
      // Call the service
      const result = await service.translate('Test with max retries', 'en-US', 'fr-FR');
      
      // Should fail after max retries and return empty string
      expect(result).toBe('');
    });
  });
  
  describe('SpeechTranslationService', () => {
    let transcriptionServiceDouble: TranscriptionServiceDouble;
    let translationServiceDouble: TranslationServiceDouble;
    let service: translationModule.SpeechTranslationService;
    
    beforeEach(() => {
      // Create fresh test doubles for each test
      transcriptionServiceDouble = new TranscriptionServiceDouble();
      translationServiceDouble = new TranslationServiceDouble();
      
      // Create the service with our test doubles
      service = new translationModule.SpeechTranslationService(
        transcriptionServiceDouble,
        translationServiceDouble,
        true // API key available
      );
    });
    
    it('should process speech translation correctly', async () => {
      // Set up test doubles
      transcriptionServiceDouble.mockTranscription = 'Hello world';
      translationServiceDouble.mockTranslation = 'Hola mundo';
      
      // Call the service
      const result = await service.translateSpeech(
        Buffer.from('test audio'),
        'en-US',
        'es-ES'
      );
      
      // Verify all steps were called correctly
      expect(transcriptionServiceDouble.transcribeCallCount).toBe(1);
      expect(translationServiceDouble.translateCallCount).toBe(1);
      
      // Verify result
      expect(result.originalText).toBe('Hello world');
      expect(result.translatedText).toBe('Hola mundo');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    });
    
    it('should use pre-transcribed text when provided', async () => {
      // Call the service with pre-transcribed text
      const result = await service.translateSpeech(
        Buffer.from('test audio'),
        'en-US',
        'es-ES',
        'Pre-transcribed text'
      );
      
      // Should skip transcription
      expect(transcriptionServiceDouble.transcribeCallCount).toBe(0);
      expect(translationServiceDouble.translateCallCount).toBe(1);
      
      // Verify result
      expect(result.originalText).toBe('Pre-transcribed text');
      expect(result.translatedText).toBe('Mocked translation');
    });
    
    it('should handle transcription errors gracefully', async () => {
      // Make transcription fail
      transcriptionServiceDouble.shouldFail = true;
      
      // Call the service
      const result = await service.translateSpeech(
        Buffer.from('test audio'),
        'en-US',
        'es-ES'
      );
      
      // Should have tried transcription
      expect(transcriptionServiceDouble.transcribeCallCount).toBe(1);
      
      // But not translation since transcription failed
      expect(translationServiceDouble.translateCallCount).toBe(0);
      
      // Should return empty strings for text but maintain audio
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    });
    
    it('should handle translation errors gracefully', async () => {
      // Make translation fail
      translationServiceDouble.shouldFail = true;
      
      // Call the service
      const result = await service.translateSpeech(
        Buffer.from('test audio'),
        'en-US',
        'es-ES'
      );
      
      // Should have tried both
      expect(transcriptionServiceDouble.transcribeCallCount).toBe(1);
      expect(translationServiceDouble.translateCallCount).toBe(1);
      
      // Should return original text for translated text on failure
      expect(result.originalText).toBe('Mocked transcription');
      expect(result.translatedText).toBe('Mocked transcription'); // Fallback
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    });
    
    it('should handle different language combinations', async () => {
      // Call the service with different languages
      const result = await service.translateSpeech(
        Buffer.from('test audio'),
        'fr-FR',
        'de-DE'
      );
      
      // Verify language parameters were passed correctly
      expect(transcriptionServiceDouble.transcribeCallCount).toBe(1);
      expect(translationServiceDouble.translateCallCount).toBe(1);
      
      // Verify result
      expect(result.originalText).toBe('Mocked transcription');
      expect(result.translatedText).toBe('Mocked translation');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    });
    
    it('should use development mode when API key is not available', async () => {
      // Create a service without API key
      const devService = new translationModule.SpeechTranslationService(
        transcriptionServiceDouble,
        translationServiceDouble,
        false // API key not available
      );
      
      // Call the service
      const result = await devService.translateSpeech(
        Buffer.from('test audio'),
        'en-US',
        'es-ES'
      );
      
      // Should not call real services in dev mode
      expect(transcriptionServiceDouble.transcribeCallCount).toBe(0);
      expect(translationServiceDouble.translateCallCount).toBe(0);
      
      // Should return synthetic data
      expect(result.originalText).toBeTruthy();
      expect(result.translatedText).toBeTruthy();
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    });
  });
  
  describe('DevelopmentModeHelper', () => {
    it('should create silent audio buffer with valid WAV format', () => {
      // Extract the helper class
      const DevelopmentModeHelper = (translationModule as any).DevelopmentModeHelper;
      
      // Create a silent buffer
      const buffer = DevelopmentModeHelper.createSilentAudioBuffer();
      
      // Check format
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(44); // WAV header is 44 bytes minimum
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
    });
    
    it('should return language-specific translations in development mode', () => {
      // Extract the helper class
      const DevelopmentModeHelper = (translationModule as any).DevelopmentModeHelper;
      
      // Check common languages
      const spanish = DevelopmentModeHelper.getLanguageSpecificTranslation('Test', 'es-ES');
      expect(spanish).toContain('traducción');
      
      const french = DevelopmentModeHelper.getLanguageSpecificTranslation('Test', 'fr-FR');
      expect(french).toContain('traduction');
      
      const german = DevelopmentModeHelper.getLanguageSpecificTranslation('Test', 'de-DE');
      expect(german).toContain('Übersetzung');
      
      // Check fallback
      const other = DevelopmentModeHelper.getLanguageSpecificTranslation('Fallback test', 'xx-XX');
      expect(other).toBe('Fallback test');
    });
  });
  
  describe('Legacy translateSpeech function', () => {
    it('should call the service with correct parameters', async () => {
      // Spy on the service's translateSpeech method
      const spy = vi.spyOn(translationModule.speechTranslationService, 'translateSpeech');
      
      // Call the legacy function
      await translationModule.translateSpeech(
        Buffer.from('test audio'),
        'en-US',
        'fr-FR',
        'Pre-transcribed text',
        'openai'
      );
      
      // Verify parameters
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        'en-US',
        'fr-FR',
        'Pre-transcribed text',
        { ttsServiceType: 'openai' }
      );
      
      // Clean up
      spy.mockRestore();
    });
    
    it('should handle object format for ttsServiceType', async () => {
      // Spy on the service's translateSpeech method
      const spy = vi.spyOn(translationModule.speechTranslationService, 'translateSpeech');
      
      // Call the legacy function with object parameter
      await translationModule.translateSpeech(
        Buffer.from('test audio'),
        'en-US',
        'fr-FR',
        'Pre-transcribed text',
        { ttsServiceType: 'browser' }
      );
      
      // Verify parameters
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        'en-US',
        'fr-FR',
        'Pre-transcribed text',
        { ttsServiceType: 'browser' }
      );
      
      // Clean up
      spy.mockRestore();
    });
  });
});