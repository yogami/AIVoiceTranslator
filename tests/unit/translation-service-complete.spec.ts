/**
 * Complete Translation Service Tests (Vitest Version)
 * 
 * A comprehensive test that mocks all dependencies
 */
import { describe, it, expect, vi } from 'vitest';
import { Buffer } from 'buffer';

// Mock path module
vi.mock('path', () => ({
  default: {
    dirname: vi.fn(() => '/mock/dir'),
    join: vi.fn((...args) => args.join('/'))
  },
  dirname: vi.fn(() => '/mock/dir'),
  join: vi.fn((...args) => args.join('/'))
}));

// Mock url module
vi.mock('url', () => ({
  default: {
    fileURLToPath: vi.fn(() => '/mock/file/path')
  },
  fileURLToPath: vi.fn(() => '/mock/file/path')
}));

// Mock fs module
vi.mock('fs', () => {
  return {
    default: {
      writeFile: vi.fn((path, data, callback) => callback(null)),
      readFile: vi.fn((path, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, Buffer.from('mock file content'));
      }),
      mkdir: vi.fn((path, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null);
      }),
      promises: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
        mkdir: vi.fn().mockResolvedValue(undefined)
      }
    },
    writeFile: vi.fn((path, data, callback) => callback(null)),
    readFile: vi.fn((path, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
      }
      callback(null, Buffer.from('mock file content'));
    }),
    mkdir: vi.fn((path, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
      }
      callback(null);
    }),
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
      mkdir: vi.fn().mockResolvedValue(undefined)
    }
  };
});

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'Mocked transcription'
        })
      }
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Mocked translation'
              }
            }
          ]
        })
      }
    }
  }))
}));

// Mock util (for promisify)
vi.mock('util', () => ({
  promisify: vi.fn((fn) => async (...args) => {
    // Simple implementation that works for our case
    return new Promise((resolve) => {
      if (args.length > 0 && typeof args[args.length - 1] === 'function') {
        // If there's a callback, we don't promisify
        return fn(...args);
      }
      
      // Simulate calling the function with a callback
      fn(...args, (err, result) => {
        if (err) throw err;
        resolve(result);
      });
    });
  })
}));

// Mock TextToSpeechService
vi.mock('../../server/services/TextToSpeechService', () => ({
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio'))
  },
  ttsFactory: {
    getService: vi.fn(() => ({
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio'))
    }))
  }
}));

// Import the module under test after mocking
import { translateSpeech } from '../../server/services/TranslationService';

describe('Translation Service', () => {
  it('should return translated speech', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert
    expect(result).toBeDefined();
    expect(result.originalText).toBeDefined();
    expect(result.translatedText).toBeDefined();
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
});