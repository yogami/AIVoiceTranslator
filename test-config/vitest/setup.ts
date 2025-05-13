/**
 * Test Setup for Vitest
 * 
 * This file sets up mocks for node modules and handles test environment configuration.
 * It runs before any tests are executed and helps isolate tests from external dependencies.
 */

import { vi } from 'vitest';
import path from 'path';

// Mock fs module to prevent promisify errors
vi.mock('fs', async () => {
  return {
    default: {
      writeFile: vi.fn(),
      mkdir: vi.fn().mockImplementation((path, options, callback) => {
        if (typeof options === 'function') {
          options(null);
        } else if (callback) {
          callback(null);
        }
      }),
      readFile: vi.fn(),
      stat: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      constants: {
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1
      },
      promises: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
        stat: vi.fn().mockResolvedValue({ size: 1024 }),
        unlink: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined)
      }
    }
  };
});

// Mock util module to handle promisify properly
vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util');
  return {
    // Use specific properties instead of spread to avoid TS errors
    promisify: (fn: any) => {
      // If fn is undefined, provide a mock function
      if (!fn) {
        return vi.fn().mockResolvedValue(undefined);
      }
      // Only use promisify from actual if it exists
      if (actual && typeof actual.promisify === 'function') {
        return actual.promisify(fn);
      }
      // Fallback mock implementation
      return (...args: any[]) => {
        return Promise.resolve(fn(...args));
      };
    },
    // Include other commonly used util functions
    inspect: actual?.inspect || vi.fn(),
    format: actual?.format || vi.fn()
  };
});

// Mock OpenAI module
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Mocked transcription text'
          })
        }
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked translation text'
                }
              }
            ]
          })
        }
      }
    }))
  };
});

// Set up mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key';

// Global beforeEach for all tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Global afterEach for all tests
afterEach(() => {
  vi.restoreAllMocks();
});