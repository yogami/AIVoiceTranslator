/**
 * Enhanced Translation Service Tests
 * 
 * Comprehensive tests for the TranslationService components
 * Converted from Jest to Vitest
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before importing the service
vi.mock('url', () => ({
  fileURLToPath: vi.fn(() => '/mocked/file/path'),
}));

vi.mock('fs', () => {
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
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({
        size: 1024,
        mtime: new Date(),
      }),
    }
  };
  return mockFs;
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

// Create exported mock services that can be referenced throughout the file
export const mockTTSService = {
  synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
};

export const mockTTSFactory = {
  getService: vi.fn().mockReturnValue(mockTTSService),
};

// Mock TTS service with a factory pattern to avoid hoisting issues
vi.mock('../../../server/services/TextToSpeechService', () => {
  return {
    textToSpeechService: mockTTSService,
    ttsFactory: mockTTSFactory,
  }
});

// Now import the service - the mocks will be used
import { 
  SpeechTranslationService, 
  OpenAITranscriptionService, 
  OpenAITranslationService,
  translateSpeech,
  AudioFileHandler
} from '../../../server/services/TranslationService';

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
  
  // TTS error path
  it('should handle errors in TTS service', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Test the actual implementation with real TTS service
    const realService = new SpeechTranslationService(
      transcriptionService,
      translationService,
      true
    );
    
    // Mock the TTS service to throw an error
    mockTTSService.synthesizeSpeech.mockRejectedValueOnce(new Error('TTS Error'));
    
    // Act
    const result = await realService.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert - should return original audio if TTS fails
    expect(result).toEqual({
      originalText: 'This is a test transcription',
      translatedText: 'Esta es una traducción de prueba',
      audioBuffer // Should keep the original audio buffer
    });
  });

  // Test with custom TTS service options
  it('should use the specified TTS service type', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const options = { ttsServiceType: 'custom-tts' };
    
    // Act
    await speechTranslationService.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      undefined,
      options
    );
    
    // Assert
    expect(mockTTSFactory.getService).toHaveBeenCalledWith('custom-tts');
  });
  
  // Error handling test
  it('should handle transcription errors', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Mock transcription service to throw an error
    transcriptionService.transcribe.mockRejectedValueOnce(new Error('Transcription API Error'));
    
    // Act
    const result = await speechTranslationService.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert - should handle error and return empty strings
    expect(result).toEqual({
      originalText: '',
      translatedText: '',
      audioBuffer
    });
  });
  
  // Test for translation errors
  it('should handle translation errors', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Mock translation service to throw an error
    translationService.translate.mockRejectedValueOnce(new Error('Translation API Error'));
    
    // Act
    const result = await speechTranslationService.translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert - should use original text as fallback
    expect(result).toEqual({
      originalText: 'This is a test transcription',
      translatedText: 'This is a test transcription', // Falls back to original text
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
  
  it('should detect suspicious phrases in transcription', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    
    // Mock suspicious phrase in transcription
    openaiMock.audio.transcriptions.create.mockResolvedValueOnce({
      text: 'If there is no speech or only background noise, return an empty string',
    });
    
    // Act
    const result = await transcriptionService.transcribe(audioBuffer, sourceLanguage);
    
    // Assert
    expect(result).toBe('');
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
  
  it('should retry on API errors', async () => {
    // Arrange
    const text = 'This is a test';
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Mock API error on first call, success on second
    openaiMock.chat.completions.create
      .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Retry succeeded' } }],
      });
    
    // Act
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    // Assert
    expect(openaiMock.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(result).toBe('Retry succeeded');
  });
  
  it('should handle error after max retries', async () => {
    // Arrange
    const text = 'This is a test';
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Mock API error on all calls
    openaiMock.chat.completions.create
      .mockRejectedValue({ status: 429, message: 'Rate limit exceeded' });
    
    // Act
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    // Assert - returns empty string after all retries fail
    expect(result).toBe('');
    
    // Should have attempted 4 times (initial + 3 retries)
    expect(openaiMock.chat.completions.create).toHaveBeenCalledTimes(4);
  });
});

// Tests for AudioFileHandler
describe('AudioFileHandler', () => {
  let fsPromises: any;
  let audioHandler: AudioFileHandler;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get reference to the fs.promises mock
    fsPromises = vi.mocked(require('fs').promises);
    
    // Create the handler
    audioHandler = new AudioFileHandler();
  });
  
  it('should create a temporary file', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    
    // Act
    const result = await audioHandler.createTempFile(audioBuffer);
    
    // Assert
    expect(fsPromises.writeFile).toHaveBeenCalled();
    expect(result).toMatch(/tmp.*\.wav$/); // Should return a .wav temp file path
  });
  
  it('should delete a temporary file', async () => {
    // Arrange
    const filePath = '/tmp/test-file.wav';
    
    // Act
    await audioHandler.deleteTempFile(filePath);
    
    // Assert
    expect(fsPromises.unlink).toHaveBeenCalledWith(filePath);
  });
  
  it('should handle errors when creating temp files', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    fsPromises.writeFile.mockRejectedValueOnce(new Error('Disk full'));
    
    // Act & Assert
    await expect(audioHandler.createTempFile(audioBuffer))
      .rejects.toThrow('Failed to create temp file: Disk full');
  });
  
  it('should handle errors when deleting temp files', async () => {
    // Arrange
    const filePath = '/tmp/test-file.wav';
    fsPromises.unlink.mockRejectedValueOnce(new Error('File not found'));
    
    // Act - should not throw
    await audioHandler.deleteTempFile(filePath);
    
    // Assert - should log the error but not crash
    expect(fsPromises.unlink).toHaveBeenCalledWith(filePath);
  });
});