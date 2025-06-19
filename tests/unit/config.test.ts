/**
 * Tests for config.ts
 * 
 * These tests focus on the environment variable loading functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type * as path from 'path'; // Added type import for path

// Mock fs and path modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('path', async () => {
  const originalPath = (await vi.importActual('path')) as typeof path;
  return {
    ...originalPath,
    join: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
    resolve: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
    dirname: vi.fn().mockReturnValue('/mock/dir'),
  };
});

// Mock url module
vi.mock('url', () => ({
  fileURLToPath: vi.fn().mockReturnValue('/mock/dir/config.ts'),
}));

describe('Config Module (server/config.ts)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env }; // Capture the environment state after global setup (test-env.js)
  });

  beforeEach(async () => {
    vi.resetModules(); // Ensure fresh import of config.ts for each test

    // Reset process.env to a minimal clean state for each test, then set required vars
    process.env = {}; // Clear all env vars first
    process.env.NODE_ENV = 'test';
    process.env.HOST = 'localhost-test';
    process.env.PORT = '6789'; 
    process.env.LOG_LEVEL = 'debug';
    // OPENAI_API_KEY is specifically set or unset by individual tests
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original env state
  });

  it('should export OPENAI_API_KEY from process.env if set and parse other variables correctly', async () => {
    // Arrange
    const testApiKey = 'test-key-from-env-123';
    process.env.OPENAI_API_KEY = testApiKey;
    
    // Act - Dynamically import config.ts to get its exports after process.env is set
    const configModule = await import('../../server/config');
    
    // Assert
    expect(configModule.OPENAI_API_KEY).toBe(testApiKey);
    expect(configModule.config.openai.apiKey).toBe(testApiKey);
    expect(configModule.config.server.port).toBe(6789);
    expect(configModule.config.server.host).toBe('localhost-test');
    expect(configModule.config.app.environment).toBe('test');
    expect(configModule.config.app.logLevel).toBe('debug');
  });

  it('should export OPENAI_API_KEY as undefined if not set and parse other variables correctly', async () => {
    // Arrange
    delete process.env.OPENAI_API_KEY; // Ensure it's not set
    
    // Act
    const configModule = await import('../../server/config');
    
    // Assert
    expect(configModule.OPENAI_API_KEY).toBeUndefined();
    expect(configModule.config.openai.apiKey).toBeUndefined();
    expect(configModule.config.server.port).toBe(6789);
    expect(configModule.config.server.host).toBe('localhost-test');
    expect(configModule.config.app.environment).toBe('test');
    expect(configModule.config.app.logLevel).toBe('debug');
  });

  it('should throw an error if PORT is not set', async () => {
    delete process.env.PORT;
    try {
      await import('../../server/config');
      throw new Error('Should have thrown'); // Fail test if import doesn't throw
    } catch (e: any) {
      expect(e.message).toBe('PORT environment variable must be set.');
    }
  });

  it('should throw an error if HOST is not set', async () => {
    delete process.env.HOST;
    try {
      await import('../../server/config');
      throw new Error('Should have thrown');
    } catch (e: any) {
      expect(e.message).toBe('HOST environment variable must be set.');
    }
  });

  it('should throw an error if NODE_ENV is not set', async () => {
    delete process.env.NODE_ENV;
    try {
      await import('../../server/config');
      throw new Error('Should have thrown');
    } catch (e: any) {
      expect(e.message).toBe('NODE_ENV environment variable must be set.');
    }
  });

  it('should throw an error if LOG_LEVEL is not set', async () => {
    delete process.env.LOG_LEVEL;
    try {
      await import('../../server/config');
      throw new Error('Should have thrown');
    } catch (e: any) {
      expect(e.message).toBe('LOG_LEVEL environment variable must be set.');
    }
  });

  it('should throw an error for invalid NODE_ENV', async () => {
    process.env.NODE_ENV = 'invalid_env';
    try {
      await import('../../server/config');
      throw new Error('Should have thrown');
    } catch (e: any) {
      expect(e.message).toBe('NODE_ENV must be one of development, production, or test.');
    }
  });

  it('should throw an error for invalid LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'invalid_level';
    try {
      await import('../../server/config');
      throw new Error('Should have thrown');
    } catch (e: any) {
      expect(e.message).toBe('LOG_LEVEL must be one of debug, info, warn, or error.');
    }
  });

  // The PATHS object was removed from config.ts, so no tests needed for it.
});