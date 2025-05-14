import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Save original env
const originalEnv = { ...process.env };

describe('Config Module', () => {
  // Mock fs and path
  vi.mock('fs');
  vi.mock('path', async () => {
    const actual = await vi.importActual('path');
    return {
      ...actual,
      resolve: vi.fn(),
      join: vi.fn()
    };
  });

  beforeEach(() => {
    // Clear and reset mocks before each test
    vi.resetModules();
    vi.clearAllMocks();
    
    // Setup path mocks
    vi.mocked(path.resolve).mockReturnValue('/mock/root/dir');
    vi.mocked(path.join).mockReturnValue('/mock/root/dir/.env');
  });

  afterEach(() => {
    // Restore env after each test
    process.env = { ...originalEnv };
  });

  it('should export OPENAI_API_KEY from environment', async () => {
    // Arrange
    const expectedApiKey = 'test-api-key-123';
    process.env.OPENAI_API_KEY = expectedApiKey;
    
    // Add an env file that doesn't override OPENAI_API_KEY
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('OTHER_VAR=other-value');
    
    // Act
    const { OPENAI_API_KEY } = await import('../../server/config');
    
    // Assert
    expect(OPENAI_API_KEY).toBe(expectedApiKey);
  });

  it('should load variables from .env file when it exists', async () => {
    // Arrange
    delete process.env.TEST_VAR; // Ensure it's not already set
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'TEST_VAR=test-value\n' +
      'OPENAI_API_KEY=env-file-api-key\n' + 
      '# This is a comment\n' +
      'QUOTED_VAR="quoted value"\n' +
      'EMPTY_LINE=\n' +
      '\n' +
      'INVALID_LINE'
    );
    
    // Act
    const config = await import('../../server/config');
    
    // Assert
    expect(process.env.TEST_VAR).toBe('test-value');
    expect(process.env.OPENAI_API_KEY).toBe('env-file-api-key');
    expect(process.env.QUOTED_VAR).toBe('quoted value');
    expect(config.OPENAI_API_KEY).toBe('env-file-api-key');
  });

  it('should handle non-existent .env file gracefully', async () => {
    // Arrange
    process.env.OPENAI_API_KEY = 'existing-api-key';
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    // Act
    const { OPENAI_API_KEY } = await import('../../server/config');
    
    // Assert
    expect(OPENAI_API_KEY).toBe('existing-api-key');
  });

  it('should handle errors when loading .env file', async () => {
    // Arrange
    process.env.OPENAI_API_KEY = 'existing-api-key';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('File read error');
    });
    
    // Mock console.error to capture error logs
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Act
    const { OPENAI_API_KEY } = await import('../../server/config');
    
    // Assert
    expect(OPENAI_API_KEY).toBe('existing-api-key');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error loading .env file:',
      expect.any(Error)
    );
  });
});