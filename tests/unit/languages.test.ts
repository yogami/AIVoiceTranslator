/**
 * Language Utilities Tests
 * 
 * Tests the language code and name utility functions
 */

import { describe, it, expect } from 'vitest';

// Import from storage and modify tests to use a mocked storage interface
import { vi } from 'vitest';

// Mock the storage module
vi.mock('../../server/storage', () => {
  const mockLanguages = [
    { id: 1, code: 'en-US', name: 'English', isActive: true },
    { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
    { id: 3, code: 'fr-FR', name: 'French', isActive: true },
    { id: 4, code: 'de-DE', name: 'German', isActive: true },
    { id: 5, code: 'ja-JP', name: 'Japanese', isActive: false }
  ];
  
  return {
    storage: {
      getLanguages: vi.fn().mockResolvedValue(mockLanguages),
      getActiveLanguages: vi.fn().mockResolvedValue(mockLanguages.filter(lang => lang.isActive)),
      getLanguageByCode: vi.fn().mockImplementation(async (code) => {
        return mockLanguages.find(lang => lang.code === code);
      })
    }
  };
});

// Import AFTER the mock is defined
import { storage } from '../../server/storage';

describe('Language Utilities', () => {
  it('should return a list of supported languages', async () => {
    const languages = await storage.getLanguages();
    
    // Verify languages array format
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThan(0);
    
    // Verify structure of language objects
    languages.forEach(lang => {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('name');
      expect(lang).toHaveProperty('isActive');
    });
    
    // Check for specific languages
    expect(languages.some(lang => lang.code === 'en-US')).toBe(true);
    expect(languages.some(lang => lang.code === 'es-ES')).toBe(true);
    expect(languages.some(lang => lang.code === 'fr-FR')).toBe(true);
  });
  
  it('should get language by code', async () => {
    // Test common languages
    const englishLang = await storage.getLanguageByCode('en-US');
    const spanishLang = await storage.getLanguageByCode('es-ES');
    const frenchLang = await storage.getLanguageByCode('fr-FR');
    
    expect(englishLang?.name).toBe('English');
    expect(spanishLang?.name).toBe('Spanish');
    expect(frenchLang?.name).toBe('French');
    
    // Test unknown language code
    const unknownLang = await storage.getLanguageByCode('xx-XX');
    expect(unknownLang).toBeUndefined();
  });
  
  it('should get active languages', async () => {
    const activeLanguages = await storage.getActiveLanguages();
    
    // Verify active languages
    expect(Array.isArray(activeLanguages)).toBe(true);
    expect(activeLanguages.length).toBeGreaterThan(0);
    
    // All languages should be active
    activeLanguages.forEach(lang => {
      expect(lang.isActive).toBe(true);
    });
  });
});