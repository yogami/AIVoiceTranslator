/**
 * OpenAI Service Basic Tests (Vitest Version)
 * 
 * Tests the core OpenAI functionality with mock services
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI module - BEFORE imports
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'This is a test translation'
                }
              }
            ]
          })
        }
      }
    }))
  };
});

// Import the module under test
// We only import what we need to test to avoid dependency issues
import { getLangCodeFromName, getLanguageName } from '../../server/openai';

describe('OpenAI Basic Functionality Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after tests
    vi.resetAllMocks();
  });
  
  // Language code tests
  describe('Language utilities', () => {
    it('should get language code from name', () => {
      // Test English
      expect(getLangCodeFromName('English')).toBe('en-US');
      
      // Test Spanish
      expect(getLangCodeFromName('Spanish')).toBe('es-ES');
      
      // Test non-existent language
      expect(getLangCodeFromName('NonExistentLanguage')).toBe('en-US');
    });
    
    it('should get language name from code', () => {
      // Test English
      expect(getLanguageName('en-US')).toBe('English');
      
      // Test Spanish
      expect(getLanguageName('es-ES')).toBe('Spanish');
      
      // Test non-existent code
      expect(getLanguageName('xx-XX')).toBe('Unknown');
    });
  });
});