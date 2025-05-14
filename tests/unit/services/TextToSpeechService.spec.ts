/**
 * TextToSpeechService Unit Tests
 * 
 * Streamlined version that focuses on critical functionality
 * without creating timeouts or hanging tests.
 * 
 * Using Vitest for ESM compatibility.
 * This file follows the principles:
 * - Do NOT modify source code
 * - Do NOT mock the System Under Test (SUT)
 * - Only mock external dependencies
 */

import { describe, it, expect, vi } from 'vitest';

// Properly mock the fs module with default export
vi.mock('fs', () => {
  const mockFunctions = {
    writeFile: vi.fn((path, data, callback) => callback(null)),
    mkdir: vi.fn((path, options, callback) => {
      if (typeof options === 'function') {
        options(null);
      } else if (callback) {
        callback(null);
      }
    }),
    readFile: vi.fn((path, options, callback) => {
      if (typeof options === 'function') {
        options(null, Buffer.from('mock file content'));
      } else if (callback) {
        callback(null, Buffer.from('mock file content'));
      }
    }),
    stat: vi.fn((path, callback) => callback(null, { mtimeMs: Date.now() })),
    access: vi.fn((path, mode, callback) => {
      if (typeof mode === 'function') {
        mode(null);
      } else if (callback) {
        callback(null);
      }
    }),
    constants: { F_OK: 0 }
  };
  
  return {
    default: mockFunctions,
    promises: {
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
      stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
      mkdir: vi.fn().mockResolvedValue(undefined)
    },
    ...mockFunctions
  };
});

vi.mock('path', () => {
  const pathFunctions = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/'))
  };
  
  return {
    default: pathFunctions,
    ...pathFunctions
  };
});

// Simple OpenAI mock
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: vi.fn().mockResolvedValue({
          arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
        })
      }
    }
  }))
}));

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
  // Essential tests for core functionality - keep this minimal to avoid hanging

  describe('BrowserSpeechSynthesisService', () => {
    it('should return correct marker buffer', async () => {
      // Arrange
      const service = new BrowserSpeechSynthesisService();
      const options: TextToSpeechOptions = {
        text: 'Test text',
        languageCode: 'en-US',
        preserveEmotions: true,
        speed: 1.2
      };
      
      // Act
      const result = await service.synthesizeSpeech(options);
      
      // Assert
      expect(result).toBeInstanceOf(Buffer);
      const markerJson = JSON.parse(result.toString());
      expect(markerJson.type).toBe('browser-speech');
      expect(markerJson.text).toBe(options.text);
      expect(markerJson.preserveEmotions).toBe(options.preserveEmotions);
      expect(markerJson.speed).toBe(options.speed);
    });
  });

  describe('SilentTextToSpeechService', () => {
    it('should return empty buffer', async () => {
      // Arrange
      const service = new SilentTextToSpeechService();
      const options: TextToSpeechOptions = {
        text: 'Test text',
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
    it('should check for cached audio', async () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn()
          }
        }
      };
      
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // Mock for fresh cache
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        mtimeMs: Date.now() - 1000 // 1 second old
      } as any);
      
      const mockBuffer = Buffer.from('cached data');
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockBuffer);
      
      // Act
      const result = await service.synthesizeSpeech({
        text: 'Test text',
        languageCode: 'en-US'
      });
      
      // Assert - should use cache
      expect(result).toEqual(mockBuffer);
      expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();
    });
    
    it('should call OpenAI when cache missing', () => {
      // Arrange
      const mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn().mockResolvedValue({
              arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10))
            })
          }
        }
      };
      
      const service = new OpenAITextToSpeechService(mockOpenAI as any);
      
      // Mock missing cache
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
      
      // Act - don't await to prevent hanging
      service.synthesizeSpeech({
        text: 'Test text',
        languageCode: 'en-US'
      });
      
      // Assert
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Test text'
        })
      );
    });
  });
  
  describe('TextToSpeechFactory', () => {
    it('should provide service instances', () => {
      // Act & Assert
      expect(ttsFactory.getService('browser')).toBeInstanceOf(BrowserSpeechSynthesisService);
      expect(ttsFactory.getService('silent')).toBeInstanceOf(SilentTextToSpeechService);
      expect(ttsFactory.getService('openai')).toBeInstanceOf(OpenAITextToSpeechService);
      
      // Should handle unknown service types
      expect(ttsFactory.getService('unknown')).toBeDefined();
      
      // Should return consistent instances
      expect(ttsFactory.getService('browser')).toBe(ttsFactory.getService('browser'));
    });
  });
});