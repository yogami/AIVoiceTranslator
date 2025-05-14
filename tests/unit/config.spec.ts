/**
 * Tests for config.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path modules
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('OPENAI_API_KEY=mocked-api-key\nNODE_ENV=test'),
}));

vi.mock('path', () => ({
  join: vi.fn().mockReturnValue('/path/to/.env'),
  dirname: vi.fn().mockReturnValue('/server'),
  resolve: vi.fn().mockReturnValue('/root')
}));

describe('Config Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Set environment variables before import
    process.env.OPENAI_API_KEY = 'test-api-key';
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should correctly export API key from environment', async () => {
    // Import the module after setting up mocks and environment
    const configModule = await import('../../server/config');
    
    // Verify the API key is exported
    expect(configModule.OPENAI_API_KEY).toBe('test-api-key');
  });
});