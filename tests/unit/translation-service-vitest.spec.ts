/**
 * Translation Service Tests (Vitest Version)
 * 
 * Tests the core translation functionality with mock services
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI module - BEFORE imports
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'This is a test transcription'
          })
        }
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'This is a test translation'
                }
              }
            ]
          })
        }
      }
    }))
  };
});

// Mock fs module
vi.mock('fs', () => {
  return {
    default: {
      promises: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({
          size: 1024,
          mtime: new Date()
        }),
        readFile: vi.fn().mockResolvedValue(Buffer.from('test file content')),
        mkdir: vi.fn().mockResolvedValue(undefined)
      },
      createReadStream: vi.fn().mockReturnValue({
        on: vi.fn(),
        pipe: vi.fn()
      }),
      writeFile: vi.fn((path, data, callback) => callback(null)),
      mkdir: vi.fn((path, options, callback) => {
        if (typeof options === 'function') {
          options(null);
        } else {
          callback(null);
        }
      }),
      readFile: vi.fn((path, options, callback) => {
        if (typeof options === 'function') {
          options(null, Buffer.from('test data'));
        } else {
          callback(null, Buffer.from('test data'));
        }
      }),
      constants: {
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1
      },
      existsSync: vi.fn().mockReturnValue(true)
    }
  };
});

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

// Import the module under test
import { translateSpeech } from '../../server/openai';

describe('Translation Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should translate speech with valid inputs', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert - Return structure should match expected format
    expect(result).toHaveProperty('originalText');
    expect(result).toHaveProperty('translatedText');
    expect(result).toHaveProperty('audioBuffer');
  });
  
  it('should use pre-transcribed text when provided', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'This is pre-transcribed text';
    
    // Act
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Assert - Should use the provided text
    expect(result.originalText).toBe(preTranscribedText);
  });
});