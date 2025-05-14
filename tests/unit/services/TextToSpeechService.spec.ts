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
import path from 'path';

// Mock fs with importOriginal as suggested by Vitest error
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  const mockPromises = {
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() })
  };
  
  return {
    default: {
      ...actual.default,
      promises: mockPromises,
      constants: { F_OK: 0 },
      // We need to handle the functions that get promisified
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readFile: vi.fn(),
      stat: vi.fn(),
      access: vi.fn()
    }
  };
});

// Mock path with importOriginal
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: {
      ...actual.default,
      join: vi.fn((...args) => args.join('/'))
    }
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

// Import the SUT after mocking dependencies
import { 
  BrowserSpeechSynthesisService, 
  SilentTextToSpeechService,
  OpenAITextToSpeechService,
  TextToSpeechOptions,
  ttsFactory
} from '../../../server/services/TextToSpeechService';
import fs from 'fs';
import OpenAI from 'openai';

describe('TextToSpeechService - Basic Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
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
  });
  
  describe('OpenAITextToSpeechService', () => {
    let service: OpenAITextToSpeechService;
    let openaiInstance: ReturnType<typeof OpenAI>;
    
    beforeEach(() => {
      openaiInstance = new OpenAI();
      service = new OpenAITextToSpeechService(openaiInstance);
      
      // Reset fs mocks
      vi.mocked(fs.promises.access).mockReset();
      vi.mocked(fs.promises.mkdir).mockReset();
      vi.mocked(fs.promises.writeFile).mockReset();
      vi.mocked(fs.promises.readFile).mockReset();
      vi.mocked(fs.promises.stat).mockReset();
    });
    
    it('should create cache directories when they do not exist', async () => {
      // Arrange
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error('Directory not found'));
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error('Directory not found'));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      
      // Act
      const options: TextToSpeechOptions = {
        text: 'Test text',
        languageCode: 'en-US'
      };
      await service.synthesizeSpeech(options);
      
      // Assert
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(2);
    });
    
    it('should use cached audio when available and not expired', async () => {
      // Arrange
      const cacheBuffer = Buffer.from('cached audio data');
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockResolvedValue({ mtimeMs: Date.now() } as fs.Stats);
      vi.mocked(fs.promises.readFile).mockResolvedValue(cacheBuffer);
      
      // Create a spy for OpenAI create method
      const createSpy = vi.spyOn(openaiInstance.audio.speech, 'create');
      
      // Act
      const options: TextToSpeechOptions = {
        text: 'Test text',
        languageCode: 'en-US'
      };
      const result = await service.synthesizeSpeech(options);
      
      // Assert
      expect(result).toEqual(cacheBuffer);
      expect(createSpy).not.toHaveBeenCalled();
    });
    
    it('should generate new audio when cache is expired', async () => {
      // Arrange
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        mtimeMs: Date.now() - (25 * 60 * 60 * 1000) // File is 25 hours old (expired)
      } as fs.Stats);
      
      // Create a spy for OpenAI create method
      const createSpy = vi.spyOn(openaiInstance.audio.speech, 'create');
      
      // Act
      const options: TextToSpeechOptions = {
        text: 'Test text',
        languageCode: 'en-US'
      };
      await service.synthesizeSpeech(options);
      
      // Assert
      expect(createSpy).toHaveBeenCalled();
    });
    
    it('should handle errors during speech synthesis', async () => {
      // Arrange
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
      
      // Create a mock implementation that rejects
      const mockCreate = vi.fn().mockRejectedValue(new Error('API error'));
      vi.spyOn(openaiInstance.audio.speech, 'create').mockImplementation(mockCreate);
      
      // Act & Assert
      const options: TextToSpeechOptions = {
        text: 'Test text',
        languageCode: 'en-US'
      };
      await expect(service.synthesizeSpeech(options)).rejects.toThrow();
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
    
    it('should fall back to default service if requested service not found', () => {
      // Act
      const unknownService = ttsFactory.getService('non-existent-service');
      
      // Assert - should return some service instance
      expect(unknownService).toBeDefined();
    });
  });
});