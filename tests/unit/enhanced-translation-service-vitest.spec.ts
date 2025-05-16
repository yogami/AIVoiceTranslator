/**
 * Enhanced Translation Service Tests (Vitest Version)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules before importing the service
vi.mock('url', () => ({
  fileURLToPath: vi.fn(() => '/mocked/file/path'),
}));

// Mock fs module with default export
vi.mock('fs', async () => {
  const mockFs = {
    createReadStream: vi.fn(() => ({
      // Basic mock of a readable stream
      on: vi.fn(),
      pipe: vi.fn(),
    })),
    writeFile: vi.fn((path, data, callback) => callback(null)),
    unlink: vi.fn((path, callback) => callback(null)),
    stat: vi.fn((path, callback) => callback(null, {
      size: 1024,
      mtime: new Date(),
    })),
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
      unlink: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({
        size: 1024,
        mtime: new Date(),
      }),
      readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
      mkdir: vi.fn().mockResolvedValue(undefined),
    }
  };
  return {
    default: mockFs,
    ...mockFs
  };
});

// Mock OpenAI with more control for different test scenarios
const mockOpenAI = {
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
};

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => mockOpenAI),
  };
});

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

// Mock TTS service with more control
const mockTTSService = {
  synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
};

const mockTTSFactory = {
  getService: vi.fn().mockReturnValue(mockTTSService),
};

vi.mock('../../server/services/TextToSpeechService', () => ({
  textToSpeechService: mockTTSService,
  ttsFactory: mockTTSFactory,
}));

// Now import the service - the mocks will be used
import { 
  SpeechTranslationService, 
  OpenAITranscriptionService, 
  OpenAITranslationService,
  translateSpeech
} from '../../server/services/TranslationService';

// Create our own AudioFileHandler for testing since it's not exported
class AudioFileHandler {
  async createTempFile(audioBuffer: Buffer): Promise<string> {
    return '/tmp/test-audio.wav';
  }
  
  async deleteTempFile(filePath: string): Promise<void> {
    // Do nothing in the test
  }
}

// Test cases for the main service
describe('SpeechTranslationService', () => {
  let transcriptionService: any;
  let translationService: any;
  let speechTranslationService: any;
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create mock services
    transcriptionService = {
      transcribe: vi.fn().mockResolvedValue('This is a test transcription'),
    };
    
    translationService = {
      translate: vi.fn().mockResolvedValue('Esta es una traducción de prueba'),
    };
    
    // Create the service to test
    speechTranslationService = new SpeechTranslationService(
      transcriptionService,
      translationService,
      true // apiKeyAvailable
    );
  });
  
  // Happy path test
  it('should translate speech correctly', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await speechTranslationService.translateSpeech(
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
    const result = await speechTranslationService.translateSpeech(
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
  
  // Development mode path (no API key)
  it('should use development mode when API key is not available', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Create a service with apiKeyAvailable = false
    const devModeService = new SpeechTranslationService(
      transcriptionService,
      translationService,
      false // apiKeyAvailable = false
    );
    
    // Act
    const result = await devModeService.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert
    expect(transcriptionService.transcribe).not.toHaveBeenCalled();
    expect(translationService.translate).not.toHaveBeenCalled();
    expect(result).toEqual({
      originalText: expect.any(String),
      translatedText: expect.any(String),
      audioBuffer: expect.any(Buffer)
    });
    expect(result.originalText).toContain('development mode');
  });
  
  // Empty transcription path
  it('should handle empty transcription results', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Mock transcription service to return empty string
    transcriptionService.transcribe.mockResolvedValueOnce('');
    
    // Act
    const result = await speechTranslationService.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert
    expect(transcriptionService.transcribe).toHaveBeenCalled();
    expect(translationService.translate).not.toHaveBeenCalled();
    expect(result).toEqual({
      originalText: '',
      translatedText: '',
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
    vi.clearAllMocks();
    
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
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    
    // Act
    const result = await transcriptionService.transcribe(audioBuffer, sourceLanguage);
    
    // Assert
    expect(audioHandlerMock.createTempFile).toHaveBeenCalledWith(audioBuffer);
    expect(openaiMock.audio.transcriptions.create).toHaveBeenCalled();
    expect(result).toBe('This is a test transcription');
    expect(audioHandlerMock.deleteTempFile).toHaveBeenCalledWith('/tmp/test-audio.wav');
  });
  
  it('should skip transcription for small audio buffers', async () => {
    // Arrange
    const tinyAudioBuffer = Buffer.from('tiny');
    const sourceLanguage = 'en-US';
    
    // Act
    const result = await transcriptionService.transcribe(tinyAudioBuffer, sourceLanguage);
    
    // Assert
    expect(audioHandlerMock.createTempFile).not.toHaveBeenCalled();
    expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
    expect(result).toBe('');
  });
  
  it('should handle file operation errors', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    
    // Mock file operation to fail
    audioHandlerMock.createTempFile.mockRejectedValueOnce(new Error('File system error'));
    
    // Act & Assert
    await expect(transcriptionService.transcribe(audioBuffer, sourceLanguage))
      .rejects.toThrow('Transcription failed: File system error');
  });
});

// Tests for the OpenAITranslationService
describe('OpenAITranslationService', () => {
  let openaiMock: any;
  let translationService: OpenAITranslationService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
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
  
  it('should skip translation when languages are the same', async () => {
    // Arrange
    const text = 'This is a test';
    const language = 'en-US';
    
    // Act
    const result = await translationService.translate(text, language, language);
    
    // Assert
    expect(openaiMock.chat.completions.create).not.toHaveBeenCalled();
    expect(result).toBe(text);
  });
  
  it('should skip translation for empty text', async () => {
    // Arrange
    const text = '';
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    // Assert
    expect(openaiMock.chat.completions.create).not.toHaveBeenCalled();
    expect(result).toBe('');
  });
});

// Tests for AudioFileHandler
describe('AudioFileHandler', () => {
  let fsPromises: any;
  let audioHandler: AudioFileHandler;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get the mocked fs.promises
    fsPromises = vi.mocked(require('fs').promises);
    
    // Create the handler to test
    audioHandler = new AudioFileHandler();
  });
  
  it('should create and delete temp files', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio data');
    
    // Act
    const tempFilePath = await audioHandler.createTempFile(audioBuffer);
    await audioHandler.deleteTempFile(tempFilePath);
    
    // Assert
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.wav'),
      audioBuffer
    );
    expect(fsPromises.unlink).toHaveBeenCalledWith(tempFilePath);
  });
  
  it('should handle errors when creating temp files', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio data');
    fsPromises.writeFile.mockRejectedValueOnce(new Error('Write error'));
    
    // Act & Assert
    await expect(audioHandler.createTempFile(audioBuffer))
      .rejects.toThrow('Failed to create temporary audio file: Write error');
  });
  
  it('should suppress errors when deleting temp files', async () => {
    // Arrange
    const tempFilePath = '/tmp/non-existent-file.wav';
    fsPromises.unlink.mockRejectedValueOnce(new Error('File not found'));
    
    // Act & Assert - should not throw
    await expect(audioHandler.deleteTempFile(tempFilePath))
      .resolves.toBeUndefined();
  });
});