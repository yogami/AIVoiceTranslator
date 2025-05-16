/**
 * Language Utilities Tests
 * 
 * Tests the language code and name utility functions
 */
import { describe, it, expect } from 'vitest';

// No need to mock anything for these pure utility functions
import { 
  getLanguages, 
  getLanguageName, 
  getLangCodeFromName 
} from '../../server/openai';

describe('Language Utilities', () => {
  it('should return a list of supported languages', () => {
    const languages = getLanguages();
    
    // Verify languages array format
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThan(0);
    
    // Verify structure of language objects
    languages.forEach(lang => {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('name');
      expect(lang).toHaveProperty('native');
      expect(lang).toHaveProperty('isActive');
    });
    
    // Check for specific languages
    expect(languages.some(lang => lang.code === 'en-US')).toBe(true);
    expect(languages.some(lang => lang.code === 'es-ES')).toBe(true);
    expect(languages.some(lang => lang.code === 'fr-FR')).toBe(true);
  });
  
  it('should get language name from code', () => {
    // Test common languages
    expect(getLanguageName('en-US')).toBe('English');
    expect(getLanguageName('es-ES')).toBe('Spanish');
    expect(getLanguageName('fr-FR')).toBe('French');
    expect(getLanguageName('de-DE')).toBe('German');
    expect(getLanguageName('ja-JP')).toBe('Japanese');
    
    // Test unknown language code
    expect(getLanguageName('xx-XX')).toBe('Unknown');
  });
  
  it('should get language code from name', () => {
    // Test common languages
    expect(getLangCodeFromName('English')).toBe('en-US');
    expect(getLangCodeFromName('Spanish')).toBe('es-ES');
    expect(getLangCodeFromName('French')).toBe('fr-FR');
    expect(getLangCodeFromName('German')).toBe('de-DE');
    expect(getLangCodeFromName('Japanese')).toBe('ja-JP');
    
    // Test case insensitivity
    expect(getLangCodeFromName('english')).toBe('en-US');
    expect(getLangCodeFromName('SPANISH')).toBe('es-ES');
    
    // Test unknown language name
    expect(getLangCodeFromName('NonExistentLanguage')).toBe('en-US');
  });
});