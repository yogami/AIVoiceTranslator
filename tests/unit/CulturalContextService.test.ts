/**
 * Cultural Context Service Unit Tests
 * 
 * Tests the CulturalContextService class methods and functionality:
 * 1. Service initialization and cultural data loading
 * 2. Cultural adaptation logic and transformations
 * 3. Educational context application
 * 4. Language and culture support validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CulturalContextService, CulturalContext, CulturalAdaptationOptions } from '../../server/services/translation/CulturalContextService.js';

describe('CulturalContextService Unit Tests', () => {
  let service: CulturalContextService;

  beforeEach(() => {
    service = new CulturalContextService();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully', () => {
      expect(service).toBeInstanceOf(CulturalContextService);
    });

    it('should have supported cultures loaded', () => {
      const supportedCultures = service.getSupportedCultures();
      expect(supportedCultures).toBeInstanceOf(Array);
      expect(supportedCultures.length).toBeGreaterThan(0);
      
      // Verify specific cultures are supported
      expect(supportedCultures).toContain('jp');
      expect(supportedCultures).toContain('kr');
      expect(supportedCultures).toContain('de');
      expect(supportedCultures).toContain('fr');
      expect(supportedCultures).toContain('mx');
      expect(supportedCultures).toContain('br');
    });

    it('should check culture support correctly', () => {
      expect(service.isCultureSupported('jp')).toBe(true);
      expect(service.isCultureSupported('kr')).toBe(true);
      expect(service.isCultureSupported('de')).toBe(true);
      expect(service.isCultureSupported('unknown')).toBe(false);
      expect(service.isCultureSupported('')).toBe(false);
    });
  });

  describe('Cultural Adaptation Logic', () => {
    it('should adapt text for Japanese formal context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Please complete your homework.',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'middle',
          formalityLevel: 'formal',
          studentAgeGroup: 'teens'
        },
        contentType: 'instruction'
      };

      const result = await service.adaptTranslation(options);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('[FORMAL_CONTEXT]');
      expect(result).toContain('[INDIRECT_JP]');
      expect(result).toContain('[GROUP_HARMONY]');
      expect(result).toContain('[TEEN_APPROPRIATE]');
    });

    it('should adapt text for Korean formal context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Great job on your presentation!',
        sourceLanguage: 'en',
        targetLanguage: 'ko',
        culturalContext: {
          targetCulture: 'kr',
          educationalLevel: 'high',
          formalityLevel: 'formal',
          studentAgeGroup: 'teens'
        },
        contentType: 'encouragement'
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('[FORMAL_CONTEXT]');
      expect(result).toContain('[INDIRECT_KR]');
      expect(result).toContain('[GROUP_HARMONY]');
      expect(result).toContain('[SUPPORTIVE_ENCOURAGEMENT]');
    });

    it('should adapt text for German direct context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Let me explain this concept.',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        culturalContext: {
          targetCulture: 'de',
          educationalLevel: 'university',
          formalityLevel: 'semi-formal',
          studentAgeGroup: 'young-adults'
        },
        contentType: 'explanation'
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('[PRECISE]');
      expect(result).toContain('[ACADEMIC]');
      expect(result).toContain('Let me explain this concept.');
    });

    it('should adapt text for Mexican Spanish warm context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'You need to correct this mistake.',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        culturalContext: {
          targetCulture: 'mx',
          educationalLevel: 'elementary',
          formalityLevel: 'casual',
          studentAgeGroup: 'children'
        },
        contentType: 'correction'
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('[CASUAL_CONTEXT]');
      expect(result).toContain('[SIMPLE]');
      expect(result).toContain('[CHILD_FRIENDLY]');
      expect(result).toContain('[SUPPORTIVE_CORRECTION]');
    });

    it('should adapt text for Brazilian Portuguese friendly context', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'What do you think about this solution?',
        sourceLanguage: 'en',
        targetLanguage: 'pt',
        culturalContext: {
          targetCulture: 'br',
          educationalLevel: 'adult',
          formalityLevel: 'casual',
          studentAgeGroup: 'adults'
        },
        contentType: 'question'
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('[CASUAL_CONTEXT]');
      expect(result).toContain('[ADULT_LEVEL]');
      expect(result).toContain('[ENGAGING_QUESTION]');
    });
  });

  describe('Educational Context Application', () => {
    it('should apply elementary level simplification', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Analyze the complex relationship between variables.',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        culturalContext: {
          targetCulture: 'fr',
          educationalLevel: 'elementary',
          formalityLevel: 'semi-formal',
          studentAgeGroup: 'children'
        }
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('[SIMPLE]');
      expect(result).toContain('[CHILD_FRIENDLY]');
    });

    it('should apply university level enhancement', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'This is a basic concept.',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        culturalContext: {
          targetCulture: 'de',
          educationalLevel: 'university',
          formalityLevel: 'formal',
          studentAgeGroup: 'young-adults'
        }
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('[ACADEMIC]');
      expect(result).toContain('[FORMAL_CONTEXT]');
    });

    it('should apply subject-specific terminology for math', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Solve this equation by calculate the value.',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'middle',
          formalityLevel: 'formal',
          subjectArea: 'math',
          studentAgeGroup: 'teens'
        }
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('equation (方程式)');
      expect(result).toContain('calculate (計算する)');
    });

    it('should apply subject-specific terminology for science', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Design an experiment to test your hypothesis through careful observation.',
        sourceLanguage: 'en',
        targetLanguage: 'kr',
        culturalContext: {
          targetCulture: 'kr',
          educationalLevel: 'high',
          formalityLevel: 'formal',
          subjectArea: 'science',
          studentAgeGroup: 'teens'
        }
      };

      const result = await service.adaptTranslation(options);
      
      expect(result).toContain('experiment (실험)');
      expect(result).toContain('hypothesis (가설)');
      expect(result).toContain('observation (관찰)');
    });
  });

  describe('Content Type Adaptations', () => {
    it('should apply encouragement context markers', async () => {
      const contentTypes = ['encouragement'] as const;
      const cultures = ['jp', 'kr', 'de', 'fr', 'mx', 'br'];
      
      for (const culture of cultures) {
        const options: CulturalAdaptationOptions = {
          originalText: 'You are doing excellent work!',
          sourceLanguage: 'en',
          targetLanguage: 'test',
          culturalContext: {
            targetCulture: culture,
            educationalLevel: 'middle',
            formalityLevel: 'semi-formal',
            studentAgeGroup: 'teens'
          },
          contentType: 'encouragement'
        };

        const result = await service.adaptTranslation(options);
        expect(result).toMatch(/\[.*ENCOURAGEMENT\]/);
      }
    });

    it('should apply correction context markers', async () => {
      const cultures = ['jp', 'kr', 'de', 'fr', 'mx', 'br'];
      
      for (const culture of cultures) {
        const options: CulturalAdaptationOptions = {
          originalText: 'This answer is incorrect.',
          sourceLanguage: 'en',
          targetLanguage: 'test',
          culturalContext: {
            targetCulture: culture,
            educationalLevel: 'middle',
            formalityLevel: 'semi-formal',
            studentAgeGroup: 'teens'
          },
          contentType: 'correction'
        };

        const result = await service.adaptTranslation(options);
        expect(result).toMatch(/\[.*CORRECTION\]/);
      }
    });

    it('should apply question context markers', async () => {
      const cultures = ['jp', 'kr', 'de', 'fr', 'mx', 'br'];
      
      for (const culture of cultures) {
        const options: CulturalAdaptationOptions = {
          originalText: 'Can you explain your reasoning?',
          sourceLanguage: 'en',
          targetLanguage: 'test',
          culturalContext: {
            targetCulture: culture,
            educationalLevel: 'middle',
            formalityLevel: 'semi-formal',
            studentAgeGroup: 'teens'
          },
          contentType: 'question'
        };

        const result = await service.adaptTranslation(options);
        expect(result).toMatch(/\[.*QUESTION\]/);
      }
    });
  });

  describe('Age Group Adaptations', () => {
    it('should apply child-friendly adaptations', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Complete this assignment.',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        culturalContext: {
          targetCulture: 'fr',
          educationalLevel: 'elementary',
          formalityLevel: 'casual',
          studentAgeGroup: 'children'
        }
      };

      const result = await service.adaptTranslation(options);
      expect(result).toContain('[CHILD_FRIENDLY]');
    });

    it('should apply teen-appropriate adaptations', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Your project demonstrates creativity.',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        culturalContext: {
          targetCulture: 'de',
          educationalLevel: 'high',
          formalityLevel: 'semi-formal',
          studentAgeGroup: 'teens'
        }
      };

      const result = await service.adaptTranslation(options);
      expect(result).toContain('[TEEN_APPROPRIATE]');
    });

    it('should apply adult-level adaptations', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'Consider the implications of this theory.',
        sourceLanguage: 'en',
        targetLanguage: 'jp',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'adult',
          formalityLevel: 'formal',
          studentAgeGroup: 'adults'
        }
      };

      const result = await service.adaptTranslation(options);
      expect(result).toContain('[ADULT_LEVEL]');
    });
  });

  describe('Static Helper Methods', () => {
    it('should provide recommended context for Japanese', () => {
      const context = CulturalContextService.getRecommendedContext('ja');
      
      expect(context.targetCulture).toBe('jp');
      expect(context.formalityLevel).toBe('formal');
      expect(context.educationalLevel).toBe('middle');
      expect(context.studentAgeGroup).toBe('teens');
    });

    it('should provide recommended context for Korean', () => {
      const context = CulturalContextService.getRecommendedContext('ko');
      
      expect(context.targetCulture).toBe('kr');
      expect(context.formalityLevel).toBe('formal');
      expect(context.educationalLevel).toBe('middle');
    });

    it('should provide recommended context for German', () => {
      const context = CulturalContextService.getRecommendedContext('de');
      
      expect(context.targetCulture).toBe('de');
      expect(context.formalityLevel).toBe('semi-formal');
      expect(context.educationalLevel).toBe('middle');
    });

    it('should provide recommended context for French', () => {
      const context = CulturalContextService.getRecommendedContext('fr');
      
      expect(context.targetCulture).toBe('fr');
      expect(context.formalityLevel).toBe('formal');
      expect(context.educationalLevel).toBe('middle');
    });

    it('should provide recommended context for Spanish with Mexican region', () => {
      const context = CulturalContextService.getRecommendedContext('es', 'mx');
      
      expect(context.targetCulture).toBe('mx');
      expect(context.formalityLevel).toBe('semi-formal');
      expect(context.educationalLevel).toBe('middle');
    });

    it('should provide recommended context for Portuguese', () => {
      const context = CulturalContextService.getRecommendedContext('pt');
      
      expect(context.targetCulture).toBe('br');
      expect(context.formalityLevel).toBe('casual');
      expect(context.educationalLevel).toBe('middle');
    });

    it('should provide default context for unknown languages', () => {
      const context = CulturalContextService.getRecommendedContext('unknown');
      
      expect(context.targetCulture).toBe('default');
      expect(context.formalityLevel).toBe('semi-formal');
      expect(context.educationalLevel).toBe('middle');
      expect(context.studentAgeGroup).toBe('teens');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should return original text for unsupported cultures', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'This is a test message.',
        sourceLanguage: 'en',
        targetLanguage: 'unknown',
        culturalContext: {
          targetCulture: 'unsupported',
          educationalLevel: 'middle',
          formalityLevel: 'semi-formal',
          studentAgeGroup: 'teens'
        }
      };

      const result = await service.adaptTranslation(options);
      expect(result).toContain('This is a test message.');
    });

    it('should handle empty text gracefully', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: '',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'middle',
          formalityLevel: 'formal',
          studentAgeGroup: 'teens'
        }
      };

      const result = await service.adaptTranslation(options);
      // Should still apply context markers even to empty text
      expect(result).toContain('[FORMAL_CONTEXT]');
    });

    it('should handle missing subject area gracefully', async () => {
      const options: CulturalAdaptationOptions = {
        originalText: 'This is general content.',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        culturalContext: {
          targetCulture: 'de',
          educationalLevel: 'middle',
          formalityLevel: 'semi-formal',
          studentAgeGroup: 'teens'
          // subjectArea intentionally omitted
        }
      };

      const result = await service.adaptTranslation(options);
      expect(result).toContain('This is general content.');
      // Should not contain subject-specific terms
      expect(result).not.toMatch(/\([^)]+\)/); // No parenthetical translations
    });

    it('should handle concurrent adaptation requests', async () => {
      const baseOptions: CulturalAdaptationOptions = {
        originalText: 'Test message',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'middle',
          formalityLevel: 'formal',
          studentAgeGroup: 'teens'
        }
      };

      const promises = Array(5).fill(null).map((_, index) => 
        service.adaptTranslation({
          ...baseOptions,
          originalText: `Test message ${index}`
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toContain(`Test message ${index}`);
        expect(result).toContain('[FORMAL_CONTEXT]');
      });
    });
  });
});
