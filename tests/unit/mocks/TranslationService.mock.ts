// This file will be used to mock the problematic ESM-specific imports
import path from 'path';

// Mock the fileURLToPath function
export const fileURLToPath = jest.fn((url) => '/mocked/path/to/file');

// Mock __dirname and __filename constants
export const __dirname = '/mocked/path';
export const __filename = '/mocked/path/to/file';

// Mock fs functions that might be used
export const mockFs = {
  createReadStream: jest.fn(() => ({
    // Basic mock of a readable stream
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
};

// Mock dotenv
export const mockDotenv = {
  config: jest.fn(),
};

// Mock OpenAI responses
export const mockOpenAIResponses = {
  transcription: {
    text: 'This is a test transcription',
  },
  translation: {
    choices: [
      {
        message: {
          content: 'Esta es una traducción de prueba',
        },
      },
    ],
  },
};

// Mock the TTS service
export const mockTTSService = {
  synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
};

// Mock TTS factory
export const mockTTSFactory = {
  getService: jest.fn().mockReturnValue(mockTTSService),
};