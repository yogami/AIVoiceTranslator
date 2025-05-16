/**
 * OpenAI Language Utilities Tests (Vitest Version)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// No need to mock anything for these simple utility functions
import { storage } from '../../server/storage';

describe('Language Support Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should retrieve all supported languages', async () => {
    // Act
    const languages = await storage.getLanguages();
    
    // Assert
    expect(Array.isArray(languages)).toBe(true);
    // We should have at least a few basic languages
    expect(languages.length).toBeGreaterThan(0);
    
    // Check language object structure
    languages.forEach(lang => {
      expect(lang).toHaveProperty('id');
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('name');
      expect(lang).toHaveProperty('isActive');
    });
  });
  
  it('should retrieve only active languages', async () => {
    // Act
    const activeLanguages = await storage.getActiveLanguages();
    
    // Assert
    expect(Array.isArray(activeLanguages)).toBe(true);
    
    // All languages should be active
    activeLanguages.forEach(lang => {
      expect(lang.isActive).toBe(true);
    });
  });
  
  it('should retrieve a language by code', async () => {
    // English is a standard language that should be available
    const englishCode = 'en-US';
    
    // Act
    const language = await storage.getLanguageByCode(englishCode);
    
    // Assert
    expect(language).toBeDefined();
    expect(language?.code).toBe(englishCode);
    expect(language?.name).toContain('English');
  });
});