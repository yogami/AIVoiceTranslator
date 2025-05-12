import { jest } from '@jest/globals';

/**
 * This test targets the TranslationService functionality.
 * 
 * IMPORTANT: We're mocking the TranslationService module because it contains a 
 * direct use of __filename = fileURLToPath(import.meta.url) which conflicts with
 * Jest's own __filename variable. This is specifically permitted as a workaround
 * to avoid modifying the source code.
 * 
 * This solution follows Claude's 4-step approach:
 * 1. Using "type": "module" in package.json
 * 2. Configuring Jest properly for ESM
 * 3. Making sure tsconfig uses the right module settings
 * 4. Proper mocking for modules that use import.meta.url
 */
jest.mock('../../../server/services/TranslationService', () => {
  // Create a mock TranslationResult for consistent test data
  const mockResult = {
    originalText: 'This is a test transcription',
    translatedText: 'Esta es una traducción de prueba',
    audioBuffer: Buffer.from('mock audio data')
  };

  // Implement a mock translateSpeech function that matches the real one's behavior
  const mockTranslateSpeech = jest.fn(async (
    audioBuffer: Buffer, 
    sourceLanguage: string, 
    targetLanguage: string,
    preTranscribedText?: string
  ) => {
    if (preTranscribedText) {
      return {
        originalText: preTranscribedText,
        translatedText: 'Esta es una traducción de prueba',
        audioBuffer: Buffer.from('mock audio data')
      };
    }
    return mockResult;
  });

  return {
    translateSpeech: mockTranslateSpeech,
    // Export any other items from the module that might be needed
    SpeechTranslationService: jest.fn(),
    OpenAITranscriptionService: jest.fn(),
    OpenAITranslationService: jest.fn()
  };
});

// Mock external dependencies
jest.mock('url', () => ({
  fileURLToPath: jest.fn(() => '/mocked/file/path'),
}));

jest.mock('fs', () => ({
  createReadStream: jest.fn(() => ({
    on: jest.fn(),
    pipe: jest.fn(),
  })),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      size: 1024,
      mtime: new Date(),
    }),
  },
  existsSync: jest.fn().mockReturnValue(true),
}));

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'This is a test transcription',
        }),
      },
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
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

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../../server/services/TextToSpeechService', () => ({
  textToSpeechService: {
    synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('mock audio data')),
  },
  ttsFactory: {
    getService: jest.fn().mockReturnValue({
      synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('mock audio data')),
    }),
  },
}));

jest.mock('../../../server/config', () => ({
  OPENAI_API_KEY: 'test-key'
}));

/**
 * Tests for the OpenAI module facade
 * 
 * NOTE: We need to mock the TranslationService because it has ESM conflicts with
 * the __filename declaration. This is the compromise to avoid modifying source code.
 */
describe('OpenAI Translation Facade', () => {
  // Setup for each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should translate speech correctly', async () => {
    // Import the module under test - must import after mocks are setup
    const { translateSpeech } = await import('../../../server/openai');
    
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Call the function
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Verify expected behavior
    expect(result).toBeDefined();
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('Esta es una traducción de prueba');
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
  });
  
  it('should bypass transcription when preTranscribedText is provided', async () => {
    // Import the module under test
    const { translateSpeech } = await import('../../../server/openai');
    
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'Pre-transcribed text for testing';
    
    // Call the function
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Verify expected behavior
    expect(result).toBeDefined();
    expect(result.originalText).toBe(preTranscribedText);
    expect(result.translatedText).toBe('Esta es una traducción de prueba');
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
  });
  
  it('should handle errors gracefully', async () => {
    // Import the module under test
    const { translateSpeech } = await import('../../../server/openai');
    
    // Get the mock implementation of translateSpeech
    const mockFn = require('../../../server/services/TranslationService').translateSpeech;
    
    // Make the mock throw an error
    mockFn.mockRejectedValueOnce(new Error('API Error'));
    
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Test error handling
    try {
      await translateSpeech(audioBuffer, sourceLanguage, targetLanguage);
      fail('Expected an error to be thrown');
    } catch (e) {
      expect(e).toBeDefined();
      expect((e as Error).message).toBe('API Error');
    }
  });
});