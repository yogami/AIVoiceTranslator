/**
 * Tests for config.ts
 * 
 * These tests focus on the environment variable loading functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Create mock environment for testing
const originalEnv = { ...process.env };
let envMock: Record<string, string> = {};

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
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules(); // Ensure fresh import of config.ts for each test
    process.env = { ...originalEnv }; // Restore original env, then modify for test case
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original env state
  });

  it('should export OPENAI_API_KEY from process.env if set', async () => {
    // Arrange
    const testApiKey = 'test-key-from-env-123';
    process.env.OPENAI_API_KEY = testApiKey;
    
    // Act - Dynamically import config.ts to get its exports after process.env is set
    const configModule = await import('../../server/config');
    
    // Assert
    expect(configModule.OPENAI_API_KEY).toBe(testApiKey);
  });

  it('should export OPENAI_API_KEY as undefined if not set in process.env', async () => {
    // Arrange
    delete process.env.OPENAI_API_KEY;
    
    // Act
    const configModule = await import('../../server/config');
    
    // Assert
    expect(configModule.OPENAI_API_KEY).toBeUndefined();
  });

  // The PATHS object was removed from config.ts, so no tests needed for it.
});