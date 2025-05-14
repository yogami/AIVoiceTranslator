/**
 * Translation Service Error Handling Tests
 * 
 * Isolated test file for error handling edge cases
 * Using Vitest for ESM compatibility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('API error'))
        }
      }
    }))
  };
});

// Import directly after mocks
import { OpenAITranslationService } from '../../../server/services/TranslationService';
import OpenAI from 'openai';

describe('TranslationService Error Handling', () => {
  let openaiMock: any;
  let translationService: OpenAITranslationService;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create OpenAI mock
    openaiMock = new OpenAI({ apiKey: 'mock-key' });
    
    // Create the service to test
    translationService = new OpenAITranslationService(openaiMock as any);
  });
  
  it('should return empty string on API errors', async () => {
    // Arrange
    const text = 'Test text';
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // No need to mock rejection as it's already set up globally
    
    // Act
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    // Assert - should return empty string for API errors
    expect(result).toBe('');
  });
});