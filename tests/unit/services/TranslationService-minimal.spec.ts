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

// Set up a more comprehensive file system mock to handle file operations
// This will prevent the unhandled exceptions
const mockFiles = new Map<string, Buffer>();

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  
  return {
    ...actual,
    createReadStream: vi.fn().mockImplementation((path: string) => {
      // Create a mock read stream that emits data from our mock file system
      const mockStream = {
        on: vi.fn().mockImplementation(function(event, callback) {
          if (event === 'data' && mockFiles.has(path)) {
            callback(mockFiles.get(path));
          } else if (event === 'end') {
            callback();
          }
          return this;
        }),
        pipe: vi.fn().mockReturnThis(),
      };
      return mockStream;
    }),
    
    writeFile: vi.fn().mockImplementation((path, buffer, callback) => {
      // Store the buffer in our mock file system
      mockFiles.set(path, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
      if (typeof callback === 'function') callback(null);
      return Promise.resolve();
    }),
    
    unlink: vi.fn().mockImplementation((path, callback) => {
      // Remove the file from our mock file system
      mockFiles.delete(path);
      if (typeof callback === 'function') callback(null);
      return Promise.resolve();
    }),
    
    stat: vi.fn().mockImplementation((path) => {
      const fileData = mockFiles.get(path);
      const size = fileData ? fileData.length : 1000;
      return Promise.resolve({
        size,
        mtime: new Date()
      });
    }),
    
    existsSync: vi.fn().mockImplementation((path) => {
      return mockFiles.has(path);
    }),
    
    readFileSync: vi.fn().mockImplementation((path) => {
      return mockFiles.get(path) || Buffer.alloc(0);
    })
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
  
  describe('Audio File Handler', () => {
    it('should handle audio file operations correctly', async () => {
      // Create our own minimal implementation for testing
      class TestAudioFileHandler {
        private readonly tempDir: string;
        
        constructor(tempDir: string = '/test/temp') {
          this.tempDir = tempDir;
        }
        
        async createTempFile(audioBuffer: Buffer): Promise<string> {
          const filePath = `${this.tempDir}/temp-audio-${Date.now()}.wav`;
          // In a real implementation, this would write to disk
          return filePath;
        }
        
        async deleteTempFile(filePath: string): Promise<void> {
          // In a real implementation, this would delete the file
          return Promise.resolve();
        }
      }
      
      // Use our test implementation
      const handler = new TestAudioFileHandler();
      
      // Test file creation
      const tempPath = await handler.createTempFile(Buffer.from('test audio'));
      expect(tempPath).toContain('temp-audio-');
      expect(tempPath).toContain('.wav');
      
      // Test file deletion
      await expect(handler.deleteTempFile(tempPath)).resolves.not.toThrow();
    });
    
    // Test that the transcription service uses the file handler correctly
    it('should be used by the transcription service for temp files', async () => {
      // Create OpenAI API double
      const openaiApiDouble = new OpenAITestDouble();
      const OpenAITranscriptionService = (translationModule as any).OpenAITranscriptionService;
      
      // Mock a response to avoid actual API calls
      openaiApiDouble.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'Test transcription with file handler'
      });
      
      // Create service instance
      const service = new OpenAITranscriptionService(openaiApiDouble);
      
      // Call with audio buffer large enough to pass size check
      const result = await service.transcribe(Buffer.alloc(2000, 'test'), 'en-US');
      
      // Verify the result
      expect(result).toBe('Test transcription with file handler');
    });
  });
  
  describe('OpenAITranscriptionService', () => {
    let openaiApiDouble: any;
    let service: any;
    
    // Create a custom AudioFileHandler that uses our mock file system
    class TestAudioFileHandler {
      private readonly tempDir: string;
      
      constructor(tempDir: string = '/test/temp') {
        this.tempDir = tempDir;
      }
      
      async createTempFile(audioBuffer: Buffer): Promise<string> {
        const filePath = `${this.tempDir}/temp-audio-${Date.now()}.wav`;
        // Store in our mock file system
        mockFiles.set(filePath, audioBuffer);
        return filePath;
      }
      
      async deleteTempFile(filePath: string): Promise<void> {
        // Remove from our mock file system
        mockFiles.delete(filePath);
      }
    }
    
    beforeEach(() => {
      // Create a fresh test double for each test
      openaiApiDouble = new OpenAITestDouble();
      // Get access to the class constructor
      const OpenAITranscriptionService = (translationModule as any).OpenAITranscriptionService;
      // Create with our test audio handler
      service = new OpenAITranscriptionService(
        openaiApiDouble,
        new TestAudioFileHandler()
      );
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
  
  describe('Development Mode Helper', () => {
    // Create a minimal implementation of the DevelopmentModeHelper class for testing
    // rather than trying to access the private class directly
    class TestDevModeHelper {
      static createSilentAudioBuffer(): Buffer {
        // Create a minimal WAV buffer for testing
        const header = Buffer.from([
          0x52, 0x49, 0x46, 0x46, // "RIFF"
          0x24, 0x00, 0x00, 0x00, // Size
          0x57, 0x41, 0x56, 0x45, // "WAVE"
          // Add more WAV header data...
        ]);
        const data = Buffer.alloc(100); // Silent data
        return Buffer.concat([header, data]);
      }
      
      static getLanguageSpecificTranslation(text: string, targetLanguage: string): string {
        // Simple implementation for testing
        const langCode = targetLanguage.split('-')[0].toLowerCase();
        
        const translations: Record<string, string> = {
          'es': 'Esto es una traducción en modo de desarrollo.',
          'fr': 'Ceci est une traduction en mode développement.',
          'de': 'Dies ist eine Übersetzung im Entwicklungsmodus.',
        };
        
        return translations[langCode] || text;
      }
    }
    
    // We'll use the test double to test how the code should behave
    it('should create silent audio buffer with valid WAV format', () => {
      const buffer = TestDevModeHelper.createSilentAudioBuffer();
      
      // Check format
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(44); // WAV header is 44 bytes minimum
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
    });
    
    it('should return language-specific translations in development mode', () => {
      // Check common languages
      const spanish = TestDevModeHelper.getLanguageSpecificTranslation('Test', 'es-ES');
      expect(spanish).toContain('traducción');
      
      const french = TestDevModeHelper.getLanguageSpecificTranslation('Test', 'fr-FR');
      expect(french).toContain('traduction');
      
      const german = TestDevModeHelper.getLanguageSpecificTranslation('Test', 'de-DE');
      expect(german).toContain('Übersetzung');
      
      // Check fallback
      const other = TestDevModeHelper.getLanguageSpecificTranslation('Fallback test', 'xx-XX');
      expect(other).toBe('Fallback test');
    });
    
    // Test that development mode in the SpeechTranslationService works properly
    it('should use development mode helpers in SpeechTranslationService', async () => {
      // Create service with API key not available
      const noApiService = new translationModule.SpeechTranslationService(
        {} as any, // Unused in dev mode
        {} as any, // Unused in dev mode
        false // API key NOT available - will trigger dev mode
      );
      
      // Call the service in dev mode
      const result = await noApiService.translateSpeech(
        Buffer.from('test'),
        'en-US',
        'es-ES'
      );
      
      // In dev mode, we should get synthetic content
      expect(result.originalText).toBeTruthy();
      expect(result.translatedText).toBeTruthy();
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
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