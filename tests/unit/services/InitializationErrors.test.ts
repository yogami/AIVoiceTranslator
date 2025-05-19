/**
 * Tests for TranslationService initialization error handling
 * 
 * These tests specifically target the uncovered error paths in the module initialization
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';

describe('TranslationService initialization error handling', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Mock console methods to capture outputs
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Reset modules before each test to force re-initialization
    vi.resetModules();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    
    // Clean up mocks
    vi.restoreAllMocks();
  });
  
  it('should warn when OpenAI API key is missing', async () => {
    // Remove the API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    // Force re-initialization of the module
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    
    // Import the module which will trigger initialization
    await import('../../../server/services/TranslationService');
    
    // Verify warnings were logged
    expect(consoleWarnSpy).toHaveBeenCalledWith('OpenAI API key status: Missing');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'OPENAI_API_KEY is missing or empty. This might cause API failures.'
    );
    
    // Restore API key if it existed
    if (apiKey) {
      process.env.OPENAI_API_KEY = apiKey;
    }
  });
  
  it('should handle errors during OpenAI client initialization', async () => {
    // Mock OpenAI to throw an error during initialization
    vi.mock('openai', () => {
      return {
        default: class MockOpenAI {
          constructor() {
            throw new Error('Simulated OpenAI initialization error');
          }
        }
      };
    });
    
    // Force module re-initialization
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Import the module which will trigger initialization
    await import('../../../server/services/TranslationService');
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error initializing OpenAI client:',
      expect.any(Error)
    );
  });
});