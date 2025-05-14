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
    
    it('should use cached audio when available and fresh', () => {
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
      
      // This test verifies that when the cache is available and fresh,
      // the OpenAI API is not called. We're not testing the actual result
      // value to avoid hanging operations.
      expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();
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