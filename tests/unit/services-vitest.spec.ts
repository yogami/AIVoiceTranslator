/**
 * Services Unit Tests (Vitest Version)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Test transcription result'
          })
        }
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Test translation result'
                }
              }
            ]
          })
        }
      }
    }))
  };
});

// Import service modules after mocking
import { storage } from '../../server/storage';

describe('Storage Service Tests', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should have a valid storage implementation', () => {
    // Check if storage is properly initialized
    expect(storage).toBeDefined();
    
    // Check if required methods exist
    expect(typeof storage.getLanguages).toBe('function');
    expect(typeof storage.getActiveLanguages).toBe('function');
    expect(typeof storage.getLanguageByCode).toBe('function');
  });
  
  it('should expose the correct interface methods', () => {
    // User methods
    expect(typeof storage.getUser).toBe('function');
    expect(typeof storage.getUserByUsername).toBe('function');
    expect(typeof storage.createUser).toBe('function');
    
    // Language methods
    expect(typeof storage.getLanguages).toBe('function');
    expect(typeof storage.getActiveLanguages).toBe('function');
    expect(typeof storage.getLanguageByCode).toBe('function');
    expect(typeof storage.createLanguage).toBe('function');
    expect(typeof storage.updateLanguageStatus).toBe('function');
    
    // Translation methods
    expect(typeof storage.addTranslation).toBe('function');
    expect(typeof storage.getTranslationsByLanguage).toBe('function');
    
    // Transcript methods
    expect(typeof storage.addTranscript).toBe('function');
    expect(typeof storage.getTranscriptsBySession).toBe('function');
  });
});