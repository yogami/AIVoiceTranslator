// This file will be referenced in your Jest config to set up global mocks
import { jest } from '@jest/globals';

// Mock the url module - critical for ESM compatibility
jest.mock('url', () => ({
  fileURLToPath: jest.fn((url: string) => '/mocked/path/to/file'),
}));

// Mock the fs module
jest.mock('fs', () => ({
  createReadStream: jest.fn(() => ({
    on: jest.fn(),
    pipe: jest.fn(),
  })),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined as any),
    unlink: jest.fn().mockResolvedValue(undefined as any),
    stat: jest.fn().mockResolvedValue({
      size: 1024,
      mtime: new Date(),
    } as any),
  },
  // Include standard fs methods needed by the tests
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('mocked file content'),
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  resolve: jest.fn((...args: string[]) => args.join('/')),
  join: jest.fn((...args: string[]) => args.join('/')),
  dirname: jest.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

// Add other global mocks here if needed, but DO NOT mock the SUT
// (TranslationService)

// You can add other global mocks here as needed