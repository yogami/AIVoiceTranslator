/**
 * Translation Service Empty Response Tests
 * 
 * Isolated test file for empty API response edge cases
 * Using Vitest for ESM compatibility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [] // Empty choices array
          })
        }
      }
    }))
  };
});

// Import directly after mocks
import { OpenAITranslationService } from '../../../server/services/TranslationService';
import OpenAI from 'openai';

describe('TranslationService Empty Response Handling', () => {
  let openaiMock: any;
  let translationService: OpenAITranslationService;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create OpenAI mock
    openaiMock = new OpenAI({ apiKey: 'mock-key' });
    
    // Create the service to test
    translationService = new OpenAITranslationService(openaiMock as any);
  });
  
  it('should handle empty API responses gracefully', async () => {
    // Arrange
    const text = 'Test text';
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // No need to mock empty response as it's already set up globally
    
    // Act
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    // Assert - should return empty string for empty API response
    expect(result).toBe('');
  });
});