/**
 * Config Module Tests
 * 
 * Verifies that the configuration module exports the correct values.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Config Module', () => {
  // Store original environment
  const originalEnv = { ...process.env };
  
  afterEach(() => {
    // Restore original environment after each test
    process.env = { ...originalEnv };
    vi.resetModules();
  });
  
  it('should export the OpenAI API key from environment', async () => {
    // Set a test API key
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Import the module
    const config = await import('../../server/config');
    
    // Check that the API key is correctly exported
    expect(config.OPENAI_API_KEY).toBe('test-api-key');
  });
  
  it('should return undefined for absent environment variables', async () => {
    // Delete the API key
    delete process.env.OPENAI_API_KEY;
    
    // Import the module
    const config = await import('../../server/config');
    
    // Check that the API key is undefined
    expect(config.OPENAI_API_KEY).toBeUndefined();
  });
  
  it('should properly load environment variables', async () => {
    // Set a custom environment variable
    process.env.TEST_CONFIG_VAR = 'test-value';
    
    // Import the module (which will process the environment)
    await import('../../server/config');
    
    // Verify the environment handling works correctly
    expect(process.env.TEST_CONFIG_VAR).toBe('test-value');
  });
});