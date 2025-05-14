/**
 * TextToSpeechService Unit Tests
 * 
 * Using Vitest for ESM compatibility.
 * This file follows the principles:
 * - Do NOT modify source code
 * - Do NOT mock the System Under Test (SUT)
 * - Only mock external dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as any;
  const mockPromises = {
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() })
  };
  
  return {
    default: {
      ...(actual.default || {}),
      promises: mockPromises,
      constants: { F_OK: 0 },
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readFile: vi.fn(),
      stat: vi.fn(),
      access: vi.fn()
    }
  };
});

// Mock path properly with a default export
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal() as any;
  
  return {
    default: {
      ...(actual.default || {}),
      join: vi.fn((...args) => args.join('/')),
      dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/'))
    },
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/'))
  };
});

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({
            arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
          })
        }
      }
    }))
  };
});

// Now import the SUT after mocking
import { 
  BrowserSpeechSynthesisService, 
  SilentTextToSpeechService,
  OpenAITextToSpeechService,
  TextToSpeechOptions,
  ttsFactory
} from '../../../server/services/TextToSpeechService';
import fs from 'fs';

describe('TextToSpeechService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BrowserSpeechSynthesisService', () => {
    it('should return a marker buffer for browser speech synthesis', async () => {
      // Arrange
      const service = new BrowserSpeechSynthesisService();
      const options: TextToSpeechOptions = {
        text: 'Test text for browser speech',
        languageCode: 'en-US',
        preserveEmotions: true,
        speed: 1.2
      };
      
      // Act
      const result = await service.synthesizeSpeech(options);
      
      // Assert
      expect(result).toBeInstanceOf(Buffer);
      
      // Parse the marker JSON to verify contents
      const markerJson = JSON.parse(result.toString());
      expect(markerJson.type).toBe('browser-speech');
      expect(markerJson.text).toBe(options.text);
    });
    
    it('should handle all options in speech synthesis', async () => {
      // Arrange
      const service = new BrowserSpeechSynthesisService();
      
      // Various combinations of options
      const optionsTests = [
        {
          text: 'Simple text',
          languageCode: 'en-US'
        },
        {
          text: 'Text with speed',
          languageCode: 'fr-FR',
          speed: 0.8
        },
        {
          text: 'Text with preserveEmotions',
          languageCode: 'es-ES',
          preserveEmotions: true
        },
        {
          text: 'Text with autoPlay',
          languageCode: 'de-DE',
          autoPlay: false
        },
        {
          text: 'Complete options',
          languageCode: 'it-IT',
          preserveEmotions: true,
          speed: 1.5,
          autoPlay: false
        }
      ];
      
      // Act & Assert for each test case
      for (const opt of optionsTests) {
        const result = await service.synthesizeSpeech(opt);
        expect(result).toBeInstanceOf(Buffer);
        
        const markerJson = JSON.parse(result.toString());
        expect(markerJson.type).toBe('browser-speech');
        expect(markerJson.text).toBe(opt.text);
        expect(markerJson.languageCode).toBe(opt.languageCode);
        
        // Check optional properties
        if (opt.speed !== undefined) {
          expect(markerJson.speed).toBe(opt.speed);
        }
        
        if (opt.preserveEmotions !== undefined) {
          expect(markerJson.preserveEmotions).toBe(opt.preserveEmotions);
        }
        
        if (opt.autoPlay !== undefined) {
          expect(markerJson.autoPlay).toBe(opt.autoPlay);
        } else {
          // Default autoPlay should be true
          expect(markerJson.autoPlay).toBe(true);
        }
      }
    });
  });

  describe('SilentTextToSpeechService', () => {
    it('should return an empty buffer', async () => {
      // Arrange
      const service = new SilentTextToSpeechService();
      const options: TextToSpeechOptions = {
        text: 'This should produce no audio',
        languageCode: 'en-US'
      };
      
      // Act
      const result = await service.synthesizeSpeech(options);
      
      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });
    
    it('should ignore all options and always return empty buffer', async () => {
      // Arrange
      const service = new SilentTextToSpeechService();
      
      // Various combinations of options
      const optionsTests = [
        {
          text: 'Simple text',
          languageCode: 'en-US'
        },
        {
          text: 'Text with all options',
          languageCode: 'fr-FR',
          preserveEmotions: true,
          speed: 1.5,
          autoPlay: false
        },
        {
          text: '', // Even empty text
          languageCode: 'es-ES'
        }
      ];
      
      // Act & Assert for each test case
      for (const opt of optionsTests) {
        const result = await service.synthesizeSpeech(opt);
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBe(0);
      }
    });
    
    it('should handle minimal options gracefully', async () => {
      // Arrange
      const service = new SilentTextToSpeechService();
      
      // Minimal required options (missing optional fields)
      const minimalOptions: TextToSpeechOptions = {
        text: 'Text',
        languageCode: 'en-US'
      };
      
      // Act & Assert
      const result = await service.synthesizeSpeech(minimalOptions);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });
  });
  
  describe('OpenAITextToSpeechService', () => {
    it('should initialize correctly with the provided OpenAI client', () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn()
          }
        }
      };
      
      // Act
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // Assert - if initialization works, we can access properties without errors
      expect(service).toBeInstanceOf(OpenAITextToSpeechService);
    });
    
    it('should use cached audio when available and fresh', async () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn()
          }
        }
      };
      
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // Set up the mock for fs.promises.access to indicate the file exists
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      
      // Set up the mock for fs.promises.stat to return a recent timestamp
      vi.mocked(fs.promises.stat).mockResolvedValue({
        mtimeMs: Date.now() - 1000 // File is 1 second old (fresh)
      } as fs.Stats);
      
      // Set up the mock for fs.promises.readFile to return a non-empty buffer
      const mockBuffer = Buffer.from('cached audio data');
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockBuffer);
      
      const options: TextToSpeechOptions = {
        text: 'Test text for OpenAI speech',
        languageCode: 'en-US'
      };
      
      // Act
      const result = await service.synthesizeSpeech(options);
      
      // Assert - should get the cached buffer and not call OpenAI
      expect(result).toEqual(mockBuffer);
      expect(fs.promises.readFile).toHaveBeenCalled();
      expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();
    });
    
    it('should generate new audio when cache is stale', async () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn().mockResolvedValue({
              arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
            })
          }
        }
      };
      
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // File exists but is old
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        mtimeMs: Date.now() - (48 * 60 * 60 * 1000) // 48 hours old (stale)
      } as fs.Stats);
      
      const options: TextToSpeechOptions = {
        text: 'Test text for OpenAI speech',
        languageCode: 'en-US'
      };
      
      // Act
      const result = await service.synthesizeSpeech(options);
      
      // Assert - should call OpenAI and write the new buffer to cache
      expect(result).toBeInstanceOf(Buffer);
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
    
    it('should generate new audio when cache doesn\'t exist', async () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn().mockResolvedValue({
              arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
            })
          }
        }
      };
      
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // File doesn't exist
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
      
      const options: TextToSpeechOptions = {
        text: 'Test text for OpenAI speech',
        languageCode: 'en-US'
      };
      
      // Act
      const result = await service.synthesizeSpeech(options);
      
      // Assert - should call OpenAI and write the new buffer to cache
      expect(result).toBeInstanceOf(Buffer);
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
    
    it('should handle OpenAI API errors gracefully', async () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      };
      
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // File doesn't exist, forcing API call
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
      
      const options: TextToSpeechOptions = {
        text: 'Test text for OpenAI speech',
        languageCode: 'en-US'
      };
      
      // Act & Assert
      await expect(service.synthesizeSpeech(options)).rejects.toThrow();
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
    });
    
    it('should expose public methods for speech synthesis', () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn()
          }
        }
      };
      
      // Act - create instance
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // Assert - verify public methods exist
      expect(service.synthesizeSpeech).toBeDefined();
      expect(typeof service.synthesizeSpeech).toBe('function');
    });
    
    it('should pass voice options to OpenAI correctly', async () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn().mockResolvedValue({
              arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
            })
          }
        }
      };
      
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // File doesn't exist, forcing API call
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
      
      const options: TextToSpeechOptions = {
        text: 'Test text for OpenAI speech',
        languageCode: 'en-US',
        voice: 'alloy'
      };
      
      // Act
      await service.synthesizeSpeech(options);
      
      // Assert - check correct parameters passed to OpenAI
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: 'alloy',
          input: options.text
        })
      );
    });
  });
  
  describe('TextToSpeechFactory', () => {
    it('should provide access to different service types', () => {
      // Act & Assert
      const browserService = ttsFactory.getService('browser');
      expect(browserService).toBeInstanceOf(BrowserSpeechSynthesisService);
      
      const silentService = ttsFactory.getService('silent');
      expect(silentService).toBeInstanceOf(SilentTextToSpeechService);
    });
    
    it('should return OpenAI service when requested', () => {
      // Act
      const openaiService = ttsFactory.getService('openai');
      
      // Assert
      expect(openaiService).toBeDefined();
      expect(openaiService).toBeInstanceOf(OpenAITextToSpeechService);
    });
    
    it('should fall back to default service if requested service not found', () => {
      // Act
      const unknownService = ttsFactory.getService('non-existent-service');
      
      // Assert - should return some service instance
      expect(unknownService).toBeDefined();
    });
    
    it('should return the same instance when requesting the same service type', () => {
      // Act
      const service1 = ttsFactory.getService('browser');
      const service2 = ttsFactory.getService('browser');
      
      // Assert - same instance (singleton pattern)
      expect(service1).toBe(service2);
    });
    
    it('should return services without requiring case-sensitive service type', () => {
      // Act - request with different case
      const service1 = ttsFactory.getService('BROWSER');
      const service2 = ttsFactory.getService('Browser');
      const service3 = ttsFactory.getService('browser');
      
      // Assert - all should be the same instance
      expect(service1).toBe(service3);
      expect(service2).toBe(service3);
      expect(service1).toBeInstanceOf(BrowserSpeechSynthesisService);
    });
    
    it('should allow accessing the default service directly', () => {
      // Act
      const defaultService = ttsFactory.getDefaultService();
      
      // Assert - should be defined and an instance of one of our services
      expect(defaultService).toBeDefined();
      expect(defaultService).toBeInstanceOf(Object);
    });
  });
});