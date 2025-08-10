import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CulturalContextService, type CulturalContext, type CulturalAdaptationOptions } from '../../../../server/services/translation/CulturalContextService.js';

describe('CulturalContextService', () => {
  let culturalContextService: CulturalContextService;

  beforeEach(() => {
    culturalContextService = new CulturalContextService();
  });

  describe('constructor', () => {
    it('should initialize successfully', () => {
      expect(culturalContextService).toBeDefined();
    });
  });

  describe('adaptTranslation', () => {
    it('should adapt translation for Japanese cultural context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Hello class, please open your books.',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'elementary',
          formalityLevel: 'formal',
          subjectArea: 'general',
          studentAgeGroup: 'children'
        }
      };

      const result = await culturalContextService.adaptTranslation(options);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should adapt translation for Korean cultural context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Great job on your homework!',
        sourceLanguage: 'en',
        targetLanguage: 'ko',
        culturalContext: {
          targetCulture: 'kr',
          educationalLevel: 'middle',
          formalityLevel: 'semi-formal',
          subjectArea: 'general',
          studentAgeGroup: 'teens'
        }
      };

      const result = await culturalContextService.adaptTranslation(options);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle university-level formal context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Today we will study advanced calculus.',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        culturalContext: {
          targetCulture: 'de',
          educationalLevel: 'university',
          formalityLevel: 'formal',
          subjectArea: 'math',
          studentAgeGroup: 'young-adults'
        }
      };

      const result = await culturalContextService.adaptTranslation(options);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty or invalid input gracefully', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: '',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        culturalContext: {
          targetCulture: 'mx',
          educationalLevel: 'elementary',
          formalityLevel: 'casual',
          studentAgeGroup: 'children'
        }
      };

      const result = await culturalContextService.adaptTranslation(options);

      expect(typeof result).toBe('string');
    });

    it('should handle unsupported cultures gracefully', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Test text',
        sourceLanguage: 'en',
        targetLanguage: 'unknown',
        culturalContext: {
          targetCulture: 'unknown',
          educationalLevel: 'elementary',
          formalityLevel: 'casual',
          studentAgeGroup: 'children'
        }
      };

      const result = await culturalContextService.adaptTranslation(options);

      expect(typeof result).toBe('string');
    });
  });

  describe('getSupportedCultures', () => {
    it('should return list of supported cultures', () => {
      const cultures = culturalContextService.getSupportedCultures();
      
      expect(Array.isArray(cultures)).toBe(true);
      expect(cultures.length).toBeGreaterThan(0);
      expect(cultures).toContain('jp');
      expect(cultures).toContain('kr');
      expect(cultures).toContain('de');
    });
  });

  describe('isCultureSupported', () => {
    it('should return true for supported cultures', () => {
      expect(culturalContextService.isCultureSupported('jp')).toBe(true);
      expect(culturalContextService.isCultureSupported('kr')).toBe(true);
      expect(culturalContextService.isCultureSupported('de')).toBe(true);
    });

    it('should return false for unsupported cultures', () => {
      expect(culturalContextService.isCultureSupported('unknown')).toBe(false);
      expect(culturalContextService.isCultureSupported('')).toBe(false);
      expect(culturalContextService.isCultureSupported('xyz')).toBe(false);
    });
  });
});
