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

describe('Config Module', () => {
  // Reset environment and mocks before each test
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    
    // Mock console methods to prevent noise in test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset the mock implementation of fs.existsSync
    (fs.existsSync as any).mockReset();
    (fs.readFileSync as any).mockReset();
  });
  
  // Restore environment after each test
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });
  
  it('should load variables from existing .env file', async () => {
    // Arrange
    const mockEnvContent = 'API_KEY=test-key\nANOTHER_KEY=value\n# Comment line\nEMPTY_KEY=';
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(mockEnvContent);
    
    // Act - import the module which will run the top-level code
    await import('../../server/config');
    
    // Assert
    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(process.env.API_KEY).toBe('test-key');
    expect(process.env.ANOTHER_KEY).toBe('value');
  });
  
  it('should handle non-existent .env file', async () => {
    // Arrange
    (fs.existsSync as any).mockReturnValue(false);
    
    // Act - import the module which will run the top-level code
    await import('../../server/config');
    
    // Assert
    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
  
  it('should handle errors when reading .env file', async () => {
    // Arrange
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockImplementation(() => {
      throw new Error('Failed to read file');
    });
    
    // Act - import the module which will run the top-level code
    await import('../../server/config');
    
    // Assert
    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Error loading .env file:',
      expect.any(Error)
    );
  });
  
  it('should handle special characters and formatting in .env values', async () => {
    // Arrange
    const mockEnvContent = 'QUOTED_KEY="quoted value"\nSINGLE_QUOTED=\'single quoted\'\nSPACE_AROUND = value ';
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(mockEnvContent);
    
    // Act - import the module which will run the top-level code
    await import('../../server/config');
    
    // Assert
    expect(process.env.QUOTED_KEY).toBe('quoted value');
    expect(process.env.SINGLE_QUOTED).toBe('single quoted');
    expect(process.env.SPACE_AROUND).toBe('value');
  });
  
  it('should export environment variables correctly', async () => {
    // Arrange
    process.env.OPENAI_API_KEY = 'test-api-key';
    (fs.existsSync as any).mockReturnValue(false);
    
    // Act - import the module
    const config = await import('../../server/config');
    
    // Assert
    expect(config.OPENAI_API_KEY).toBe('test-api-key');
  });
  
  it('should handle malformed lines in .env file', async () => {
    // Arrange
    const mockEnvContent = 'VALID_KEY=value\nMALFORMED_LINE\nEMPTY_LINE=\nANOTHER_KEY=another-value';
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(mockEnvContent);
    
    // Act - import the module which will run the top-level code
    await import('../../server/config');
    
    // Assert
    expect(process.env.VALID_KEY).toBe('value');
    expect(process.env.ANOTHER_KEY).toBe('another-value');
    // Malformed line should be ignored
    expect(process.env.MALFORMED_LINE).toBeUndefined();
  });
});