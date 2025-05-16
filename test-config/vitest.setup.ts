// This file will be referenced in your Vitest config to set up global mocks
import { vi } from 'vitest';

// Mock the url module - critical for ESM compatibility
vi.mock('url', () => ({
  fileURLToPath: vi.fn((url: string) => '/mocked/path/to/file'),
}));

// Mock the fs module
vi.mock('fs', () => ({
  createReadStream: vi.fn(() => ({
    on: vi.fn(),
    pipe: vi.fn(),
  })),
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined as any),
    unlink: vi.fn().mockResolvedValue(undefined as any),
    stat: vi.fn().mockResolvedValue({
      size: 1024,
      mtime: new Date(),
    } as any),
  },
  // Include standard fs methods needed by the tests
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('mocked file content'),
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
  resolve: vi.fn((...args: string[]) => args.join('/')),
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

// Add other global mocks here if needed, but DO NOT mock the SUT
// (TranslationService)