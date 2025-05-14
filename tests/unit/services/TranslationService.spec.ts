/**
 * TranslationService Unit Tests
 * 
 * Using Vitest for ESM compatibility.
 * This file follows the principles:
 * - Do NOT modify source code
 * - Do NOT mock the System Under Test (SUT)
 * - Only mock external dependencies
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Vitest hoists vi.mock calls to the top of the file, so we need to declare
// the mock implementations without using variables defined later in the file

// Mock URL
vi.mock('url', () => {
  const mockUrl = {
    fileURLToPath: vi.fn(() => '/mocked/file/path')
  };
  
  return {
    ...mockUrl,
    default: mockUrl
  };
});

// Mock File System
vi.mock('fs', () => {
  const mockFs = {
    createReadStream: vi.fn(() => ({
      on: vi.fn(),
      pipe: vi.fn(),
    })),
    writeFile: vi.fn((path, data, callback) => callback(null)),
    unlink: vi.fn((path, callback) => callback(null)),
    mkdir: vi.fn((path, options, callback) => {
      if (typeof options === 'function') {
        options(null);
      } else if (callback) {
        callback(null);
      }
    }),
    stat: vi.fn((path, callback) => callback(null, {
      size: 1024,
      mtime: new Date(),
      mtimeMs: Date.now(),
    })),
    access: vi.fn((path, mode, callback) => {
      if (typeof mode === 'function') {
        mode(null);
      } else if (callback) {
        callback(null);
      }
    }),
    readFile: vi.fn((path, options, callback) => {
      if (typeof options === 'function') {
        options(null, Buffer.from('mock-file-content'));
      } else if (callback) {
        callback(null, Buffer.from('mock-file-content'));
      }
    }),
    constants: {
      F_OK: 0,
      R_OK: 4,
      W_OK: 2,
      X_OK: 1,
    },
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(Buffer.from('mock-file-content')),
      access: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({
        size: 1024,
        mtime: new Date(),
        mtimeMs: Date.now(),
      }),
    }
  };
  
  return {
    ...mockFs,
    default: mockFs
  };
});

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'This is a test transcription',
        }),
      },
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Esta es una traducción de prueba',
              },
            },
          ],
        }),
      },
    },
  })),
}));

// Mock dotenv
vi.mock('dotenv', () => {
  return {
    default: {
      config: vi.fn()
    },
    config: vi.fn()
  };
});

// Mock util module - needed for promisify function used in TextToSpeechService
vi.mock('util', () => {
  return {
    promisify: vi.fn((fn) => fn),
    default: {
      promisify: vi.fn((fn) => fn)
    }
  };
});

// Mock crypto module
vi.mock('crypto', () => {
  const mockHashUpdate = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mocked-hash-value')
  };

  const mockCreateHash = vi.fn().mockReturnValue(mockHashUpdate);

  return {
    createHash: mockCreateHash,
    default: {
      createHash: mockCreateHash
    }
  };
});

// Mock path module
vi.mock('path', () => {
  const mockJoin = vi.fn((...paths) => paths.join('/'));
  
  return {
    join: mockJoin,
    resolve: vi.fn((...paths) => paths.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
    basename: vi.fn((p) => p.split('/').pop()),
    default: {
      join: mockJoin,
      resolve: vi.fn((...paths) => paths.join('/')),
      dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
      basename: vi.fn((p) => p.split('/').pop())
    }
  };
});

// Set up manual mocks for TTS service - don't use vi.mock which can affect the application
const mockTtsService = {
  synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
};

const mockTtsFactory = {
  getService: vi.fn().mockReturnValue(mockTtsService),
};

// Now import the service - the mocks will be used
// Updated import path to match your project structure
import { 
  speechTranslationService,
  SpeechTranslationService, 
  OpenAITranscriptionService, 
  OpenAITranslationService
} from '../../../server/services/TranslationService';

// Test cases for the main service
describe('SpeechTranslationService', () => {
  let transcriptionService: any;
  let translationService: any;
  let speechTranslationServiceInstance: SpeechTranslationService;
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Create mock services
    transcriptionService = {
      transcribe: vi.fn().mockResolvedValue('This is a test transcription'),
    };
    
    translationService = {
      translate: vi.fn().mockResolvedValue('Esta es una traducción de prueba'),
    };
    
    // Create the service to test with our manual mocks
    speechTranslationServiceInstance = new SpeechTranslationService(
      transcriptionService,
      translationService,
      true // apiKeyAvailable
    );
    
    // Manually inject our mocks
    speechTranslationServiceInstance['ttsFactory'] = mockTtsFactory;
  });
  
  // Happy path test
  it('should translate speech correctly', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await speechTranslationServiceInstance.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert
    expect(transcriptionService.transcribe).toHaveBeenCalledWith(audioBuffer, sourceLanguage);
    expect(translationService.translate).toHaveBeenCalledWith(
      'This is a test transcription',
      sourceLanguage,
      targetLanguage
    );
    expect(result).toEqual({
      originalText: 'This is a test transcription',
      translatedText: 'Esta es una traducción de prueba',
      audioBuffer: expect.any(Buffer)
    });
  });
  
  // Pre-transcribed text path
  it('should bypass transcription when preTranscribedText is provided', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'Pre-transcribed text for testing';
    
    // Act
    const result = await speechTranslationServiceInstance.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Assert
    expect(transcriptionService.transcribe).not.toHaveBeenCalled();
    expect(translationService.translate).toHaveBeenCalledWith(
      preTranscribedText,
      sourceLanguage,
      targetLanguage
    );
    expect(result).toEqual({
      originalText: preTranscribedText,
      translatedText: 'Esta es una traducción de prueba',
      audioBuffer: expect.any(Buffer)
    });
  });
});

// Tests for the OpenAITranscriptionService
describe('OpenAITranscriptionService', () => {
  let openaiMock: any;
  let audioHandlerMock: any;
  let transcriptionService: OpenAITranscriptionService;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create mocks
    openaiMock = {
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'This is a test transcription',
          }),
        },
      },
    };
    
    audioHandlerMock = {
      createTempFile: vi.fn().mockResolvedValue('/tmp/test-audio.wav'),
      deleteTempFile: vi.fn().mockResolvedValue(undefined),
    };
    
    // Create the service to test
    transcriptionService = new OpenAITranscriptionService(
      openaiMock as any,
      audioHandlerMock as any
    );
  });
  
  it('should transcribe audio correctly', async () => {
    // Arrange
    // Make the buffer large enough to pass the minimum size check
    const audioBuffer = Buffer.from('test audio'.repeat(100)); // Create a larger buffer
    const sourceLanguage = 'en-US';
    
    // Act
    const result = await transcriptionService.transcribe(audioBuffer, sourceLanguage);
    
    // Assert
    expect(audioHandlerMock.createTempFile).toHaveBeenCalledWith(audioBuffer);
    expect(openaiMock.audio.transcriptions.create).toHaveBeenCalled();
    expect(result).toBe('This is a test transcription');
    expect(audioHandlerMock.deleteTempFile).toHaveBeenCalledWith('/tmp/test-audio.wav');
  });
});

// Tests for the OpenAITranslationService
describe('OpenAITranslationService', () => {
  let openaiMock: any;
  let translationService: OpenAITranslationService;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create mocks
    openaiMock = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Esta es una traducción de prueba',
                },
              },
            ],
          }),
        },
      },
    };
    
    // Create the service to test
    translationService = new OpenAITranslationService(openaiMock as any);
  });
  
  it('should translate text correctly', async () => {
    // Arrange
    const text = 'This is a test';
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    // Assert
    expect(openaiMock.chat.completions.create).toHaveBeenCalled();
    expect(result).toBe('Esta es una traducción de prueba');
  });
});