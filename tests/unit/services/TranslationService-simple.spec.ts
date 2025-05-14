/**
 * Simplified tests for the TranslationService
 * 
 * These tests focus on the public API and proper exports
 * of the TranslationService module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock util.promisify
vi.mock('util', async (importOriginal) => {
  const mockUtil = {
    promisify: vi.fn(fn => fn),
  };
  
  return {
    default: mockUtil,
    ...mockUtil
  };
});

// Mock path module
vi.mock('path', async (importOriginal) => {
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn(path => path.substring(0, path.lastIndexOf('/')) || '/'),
    resolve: vi.fn((...args) => args.join('/')),
  };
  
  return {
    default: mockPath,
    ...mockPath
  };
});

// Mock url module
vi.mock('url', async (importOriginal) => {
  const mockUrl = {
    fileURLToPath: vi.fn((url) => '/mocked/file/path'),
  };
  
  return {
    default: mockUrl,
    ...mockUrl
  };
});

// Mock OpenAI
vi.mock('openai', async (importOriginal) => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'This is a mock transcription',
        }),
      },
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'This is a mock translation',
              },
            },
          ],
        }),
      },
    },
  }));
  
  return {
    default: MockOpenAI
  };
});

// Mock fs with default export pattern
vi.mock('fs', async (importOriginal) => {
  const mockFs = {
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ size: 1024, mtime: new Date() }),
    },
    writeFile: vi.fn((path, data, callback) => callback(null)),
    unlink: vi.fn((path, callback) => callback(null)),
    stat: vi.fn((path, callback) => callback(null, { size: 1024, mtime: new Date() })),
    createReadStream: vi.fn(() => ({
      on: vi.fn(),
      pipe: vi.fn(),
    })),
  };
  
  return {
    default: mockFs,
    ...mockFs
  };
});

// Mock TextToSpeechService
vi.mock('../../../server/services/TextToSpeechService', () => {
  return {
    textToSpeechService: {
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
    },
    ttsFactory: {
      getService: vi.fn().mockReturnValue({
        synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
      }),
    },
  };
});

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('TranslationService Module Exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export the required functions and classes', async () => {
    // Import the module
    const translationModule = await import('../../../server/services/TranslationService');
    
    // Verify the exports
    expect(typeof translationModule.translateSpeech).toBe('function');
    expect(typeof translationModule.SpeechTranslationService).toBe('function');
    expect(typeof translationModule.OpenAITranscriptionService).toBe('function');
    expect(typeof translationModule.OpenAITranslationService).toBe('function');
  });

  it('should initialize services with the OpenAI client', async () => {
    // Import the module
    await import('../../../server/services/TranslationService');
    
    // Check that OpenAI was called
    const OpenAI = await import('openai');
    expect(OpenAI.default).toHaveBeenCalled();
  });

  it('should handle translation with valid inputs', async () => {
    // Import the module
    const { translateSpeech } = await import('../../../server/services/TranslationService');
    
    // Minimal valid inputs
    const audioBuffer = Buffer.from('test-audio-data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Call the function without letting it throw
    const result = await translateSpeech(audioBuffer, sourceLanguage, targetLanguage);
    
    // Basic structure checks
    expect(result).toHaveProperty('originalText');
    expect(result).toHaveProperty('translatedText');
    expect(result).toHaveProperty('audioBuffer');
  });
});