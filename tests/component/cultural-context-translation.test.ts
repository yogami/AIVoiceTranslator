/**
 * Cultural Context Translation Component Tests
 * 
 * Tests the integration of CulturalContextService with translation services:
 * 1. Cultural adaptation in translation pipeline
 * 2. Educational context awareness
 * 3. Multi-language cultural adaptation
 * 4. Real-world classroom scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CulturalContextService, CulturalAdaptationOptions } from '../../server/services/translation/CulturalContextService.js';
import { getTranslationService } from '../../server/services/translation/TranslationServiceFactory.js';

describe('Cultural Context Translation Component Tests', () => {
  let originalApiKeys: Record<string, string | undefined>;
  let culturalService: CulturalContextService;

  beforeEach(() => {
    // Store original environment variables
    originalApiKeys = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      TRANSLATION_SERVICE_TYPE: process.env.TRANSLATION_SERVICE_TYPE
    };

    // Set test environment
    process.env.TRANSLATION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    culturalService = new CulturalContextService();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalApiKeys).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  });

  describe('Cultural Adaptation Integration', () => {
    it('should integrate cultural context with translation service workflow', async () => {
      const originalText = 'Great job on your homework! Now let\'s solve this equation.';
      const translationService = getTranslationService();
      
      // Simulate translation step (would normally happen in the pipeline)
      let translatedText: string;
      try {
        translatedText = await translationService.translate(originalText, 'en-US', 'ja-JP');
      } catch (error) {
        // Use fallback for test environment
        translatedText = 'すばらしい宿題です！今度はこの方程式を解きましょう。';
      }
      
      // Apply cultural adaptation using English text (as designed)
      const culturalOptions: CulturalAdaptationOptions = {
        originalText: originalText, // Use English text for cultural adaptation
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'middle',
          formalityLevel: 'formal',
          subjectArea: 'math',
          studentAgeGroup: 'teens'
        },
        contentType: 'encouragement'
      };
      
      const culturallyAdaptedText = await culturalService.adaptTranslation(culturalOptions);
      
      expect(culturallyAdaptedText).toContain('[RESPECTFUL_ENCOURAGEMENT]');
      expect(culturallyAdaptedText).toContain('[FORMAL_CONTEXT]');
      expect(culturallyAdaptedText).toContain('[INDIRECT_JP]');
      expect(culturallyAdaptedText).toContain('equation (方程式)');
    });

    it('should handle educational content adaptation workflow', async () => {
      const educationalTexts = [
        { text: 'Please complete this assignment by tomorrow.', type: 'instruction' as const },
        { text: 'Your analysis is incorrect, let me help you.', type: 'correction' as const },
        { text: 'What do you think about this approach?', type: 'question' as const },
        { text: 'Excellent work on this problem!', type: 'encouragement' as const }
      ];
      
      for (const item of educationalTexts) {
        const culturalOptions: CulturalAdaptationOptions = {
          originalText: item.text,
          sourceLanguage: 'en',
          targetLanguage: 'kr',
          culturalContext: {
            targetCulture: 'kr',
            educationalLevel: 'high',
            formalityLevel: 'formal',
            studentAgeGroup: 'teens'
          },
          contentType: item.type
        };
        
        const adaptedText = await culturalService.adaptTranslation(culturalOptions);
        
        expect(adaptedText).toContain('[FORMAL_CONTEXT]');
        expect(adaptedText).toContain('[INDIRECT_KR]');
        expect(adaptedText).toContain('[GROUP_HARMONY]');
        expect(adaptedText).toContain('[TEEN_APPROPRIATE]');
        
        // Verify content-type specific adaptations
        if (item.type === 'encouragement') {
          expect(adaptedText).toContain('[SUPPORTIVE_ENCOURAGEMENT]'); // Korean culture uses SUPPORTIVE
        } else if (item.type === 'correction') {
          expect(adaptedText).toContain('[RESPECTFUL_CORRECTION]');
        } else if (item.type === 'question') {
          expect(adaptedText).toContain('[RESPECTFUL_QUESTION]');
        }
      }
    });

    it('should adapt for different educational levels appropriately', async () => {
      const baseText = 'Let\'s analyze the complex relationship between variables.';
      const educationalLevels = ['elementary', 'middle', 'high', 'university', 'adult'] as const;
      
      for (const level of educationalLevels) {
        const culturalOptions: CulturalAdaptationOptions = {
          originalText: baseText,
          sourceLanguage: 'en',
          targetLanguage: 'de',
          culturalContext: {
            targetCulture: 'de',
            educationalLevel: level,
            formalityLevel: 'semi-formal',
            studentAgeGroup: level === 'elementary' ? 'children' : 
                           level === 'adult' ? 'adults' : 'teens'
          },
          contentType: 'explanation'
        };
        
        const adaptedText = await culturalService.adaptTranslation(culturalOptions);
        expect(adaptedText).toContain('[PRECISE]');
        
        if (level === 'elementary') {
          expect(adaptedText).toContain('[SIMPLE]');
          expect(adaptedText).toContain('[CHILD_FRIENDLY]');
        } else if (level === 'university') {
          expect(adaptedText).toContain('[ACADEMIC]');
        }
      }
    });
  });

  describe('Multi-Cultural Classroom Scenarios', () => {
    it('should handle simultaneous multi-cultural adaptation', async () => {
      const teacherMessage = 'Please work together on this science experiment.';
      
      const studentGroups = [
        { culture: 'jp', language: 'ja', formality: 'formal' as const },
        { culture: 'kr', language: 'ko', formality: 'formal' as const },
        { culture: 'de', language: 'de', formality: 'semi-formal' as const },
        { culture: 'mx', language: 'es', formality: 'semi-formal' as const },
        { culture: 'br', language: 'pt', formality: 'casual' as const },
        { culture: 'fr', language: 'fr', formality: 'formal' as const }
      ];
      
      const adaptationPromises = studentGroups.map(group => 
        culturalService.adaptTranslation({
          originalText: teacherMessage,
          sourceLanguage: 'en',
          targetLanguage: group.language,
          culturalContext: {
            targetCulture: group.culture,
            educationalLevel: 'middle',
            formalityLevel: group.formality,
            subjectArea: 'science',
            studentAgeGroup: 'teens'
          },
          contentType: 'instruction'
        })
      );
      
      const adaptedMessages = await Promise.all(adaptationPromises);
      
      expect(adaptedMessages).toHaveLength(studentGroups.length);
      
      // Verify each adaptation has appropriate cultural markers
      adaptedMessages.forEach((message, index) => {
        const group = studentGroups[index];
        
        // Check for core content while allowing for cultural additions
        expect(message).toContain('Please work together');
        expect(message).toContain('science experiment');
        
        if (group.formality === 'formal') {
          expect(message).toContain('[FORMAL_CONTEXT]');
        } else if (group.formality === 'casual') {
          expect(message).toContain('[CASUAL_CONTEXT]');
        }
        
        // High-context cultures should have indirectness markers
        if (group.culture === 'jp' || group.culture === 'kr') {
          expect(message).toContain('[INDIRECT_');
          expect(message).toContain('[GROUP_HARMONY]');
        }
        
        // Precision-focused cultures
        if (group.culture === 'de') {
          expect(message).toContain('[PRECISE]');
        }
        
        // Subject-specific terms for science
        if (group.culture === 'jp' || group.culture === 'kr' || group.culture === 'de' || group.culture === 'fr') {
          expect(message).toContain('experiment');
        }
      });
    });

    it('should adapt content for different subject areas effectively', async () => {
      const subjectContents = [
        { 
          subject: 'math' as const, 
          text: 'Solve this equation by calculating the value of x.',
          expectedTerms: ['equation', 'solve'] // 'solve' and 'equation' are the actual words that get replaced
        },
        { 
          subject: 'science' as const, 
          text: 'Design an experiment to test your hypothesis through observation.',
          expectedTerms: ['experiment', 'hypothesis', 'observation']
        },
        { 
          subject: 'general' as const, 
          text: 'Please complete your assignment carefully.',
          expectedTerms: []
        }
      ];
      
      for (const content of subjectContents) {
        const culturalOptions: CulturalAdaptationOptions = {
          originalText: content.text,
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          culturalContext: {
            targetCulture: 'jp',
            educationalLevel: 'middle',
            formalityLevel: 'formal',
            subjectArea: content.subject,
            studentAgeGroup: 'teens'
          },
          contentType: 'instruction'
        };
        
        const adaptedText = await culturalService.adaptTranslation(culturalOptions);
        
        // Check for subject-specific terminology
        if (content.subject === 'math' || content.subject === 'science') {
          content.expectedTerms.forEach(term => {
            expect(adaptedText).toContain(`${term} (`);
          });
        }
      }
    });
  });

  describe('Age-Appropriate Adaptations', () => {
    it('should adapt tone and complexity for children', async () => {
      const childContent = 'Let\'s learn about numbers today!';
      
      const culturalOptions: CulturalAdaptationOptions = {
        originalText: childContent,
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        culturalContext: {
          targetCulture: 'fr',
          educationalLevel: 'elementary',
          formalityLevel: 'casual',
          studentAgeGroup: 'children'
        },
        contentType: 'encouragement'
      };
      
      const adaptedText = await culturalService.adaptTranslation(culturalOptions);
      
      expect(adaptedText).toContain('[CHILD_FRIENDLY]');
      expect(adaptedText).toContain('[SIMPLE]');
      expect(adaptedText).toContain('[CASUAL_CONTEXT]');
      expect(adaptedText).toContain('[INTELLECTUAL_ENCOURAGEMENT]');
    });

    it('should adapt complexity for university students', async () => {
      const universityContent = 'Analyze the implications of this theoretical framework.';
      
      const culturalOptions: CulturalAdaptationOptions = {
        originalText: universityContent,
        sourceLanguage: 'en',
        targetLanguage: 'de',
        culturalContext: {
          targetCulture: 'de',
          educationalLevel: 'university',
          formalityLevel: 'formal',
          studentAgeGroup: 'young-adults'
        },
        contentType: 'instruction'
      };
      
      const adaptedText = await culturalService.adaptTranslation(culturalOptions);
      
      expect(adaptedText).toContain('[ACADEMIC]');
      expect(adaptedText).toContain('[FORMAL_CONTEXT]');
      expect(adaptedText).toContain('[PRECISE]');
    });

    it('should handle mixed age groups appropriately', async () => {
      const generalContent = 'Please work on this problem step by step.';
      const ageGroups = [
        { ageGroup: 'children', expectedMarker: '[CHILD_FRIENDLY]' },
        { ageGroup: 'teens', expectedMarker: '[TEEN_APPROPRIATE]' }, 
        { ageGroup: 'adults', expectedMarker: '[ADULT_LEVEL]' }
      ] as const;
      
      for (const { ageGroup, expectedMarker } of ageGroups) {
        const culturalOptions: CulturalAdaptationOptions = {
          originalText: generalContent,
          sourceLanguage: 'en',
          targetLanguage: 'es',
          culturalContext: {
            targetCulture: 'mx',
            educationalLevel: 'middle',
            formalityLevel: 'semi-formal',
            studentAgeGroup: ageGroup
          },
          contentType: 'instruction'
        };
        
        const adaptedText = await culturalService.adaptTranslation(culturalOptions);
        
        expect(adaptedText).toContain(expectedMarker);
      }
    });
  });

  describe('Formality Level Adaptations', () => {
    it('should apply appropriate formality markers across cultures', async () => {
      const professionalContent = 'I would like to discuss your progress.';
      const formalityLevels = ['formal', 'casual'] as const; // Use German culture which supports both
      
      for (const formality of formalityLevels) {
        const culturalOptions: CulturalAdaptationOptions = {
          originalText: professionalContent,
          sourceLanguage: 'en',
          targetLanguage: 'de', // German culture
          culturalContext: {
            targetCulture: 'de',
            educationalLevel: 'adult',
            formalityLevel: formality,
            studentAgeGroup: 'adults'
          },
          contentType: 'explanation'
        };
        
        const adaptedText = await culturalService.adaptTranslation(culturalOptions);
        
        if (formality === 'formal') {
          expect(adaptedText).toContain('[FORMAL_CONTEXT]');
        } else if (formality === 'casual') {
          expect(adaptedText).toContain('[CASUAL_CONTEXT]');
        }
        
        // German context should include precision marker
        expect(adaptedText).toContain('[PRECISE]');
      }
    });

    it('should handle culture-specific formality expectations', async () => {
      const politeRequest = 'Could you please explain this concept again?';
      
      // Test cultures with different formality expectations
      const cultureTests = [
        { culture: 'jp', expectsHigh: true },    // High formality expected
        { culture: 'kr', expectsHigh: true },    // High formality expected
        { culture: 'de', expectsHigh: false },   // Direct communication preferred
        { culture: 'br', expectsHigh: false }    // Casual communication preferred
      ];
      
      for (const test of cultureTests) {
        const culturalOptions: CulturalAdaptationOptions = {
          originalText: politeRequest,
          sourceLanguage: 'en',
          targetLanguage: 'test',
          culturalContext: {
            targetCulture: test.culture,
            educationalLevel: 'middle',
            formalityLevel: 'semi-formal',
            studentAgeGroup: 'teens'
          },
          contentType: 'question'
        };
        
        const adaptedText = await culturalService.adaptTranslation(culturalOptions);
        
        if (test.expectsHigh) {
          // High-context cultures should include more formality markers
          expect(adaptedText).toContain('[INDIRECT_');
          expect(adaptedText).toContain('[GROUP_HARMONY]');
        }
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume cultural adaptations efficiently', async () => {
      const messages = Array(20).fill(null).map((_, index) => 
        `Educational message number ${index + 1}.`
      );
      
      const adaptationPromises = messages.map(message => 
        culturalService.adaptTranslation({
          originalText: message,
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          culturalContext: {
            targetCulture: 'fr',
            educationalLevel: 'middle',
            formalityLevel: 'formal',
            studentAgeGroup: 'teens'
          },
          contentType: 'explanation'
        })
      );
      
      const startTime = Date.now();
      const results = await Promise.all(adaptationPromises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      
      results.forEach((result, index) => {
        expect(result).toContain(`Educational message number ${index + 1}.`);
        expect(result).toContain('[FORMAL_CONTEXT]');
      });
    });

    it('should maintain consistent adaptation quality under concurrent load', async () => {
      const baseMessage = 'Please complete this assignment carefully.';
      const cultures = ['jp', 'kr', 'de', 'fr', 'mx', 'br'];
      
      // Create multiple concurrent adaptation requests
      const concurrentPromises = [];
      for (let i = 0; i < 30; i++) {
        const culture = cultures[i % cultures.length];
        concurrentPromises.push(
          culturalService.adaptTranslation({
            originalText: `${baseMessage} (Request ${i + 1})`,
            sourceLanguage: 'en',
            targetLanguage: 'test',
            culturalContext: {
              targetCulture: culture,
              educationalLevel: 'middle',
              formalityLevel: 'semi-formal',
              studentAgeGroup: 'teens'
            },
            contentType: 'instruction'
          })
        );
      }
      
      const results = await Promise.all(concurrentPromises);
      
      expect(results).toHaveLength(30);
      
      // Verify all adaptations maintain quality
      results.forEach((result, index) => {
        expect(result).toContain(`Request ${index + 1}`);
        expect(result).toContain('[TEEN_APPROPRIATE]');
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid cultural contexts gracefully', async () => {
      const culturalOptions: CulturalAdaptationOptions = {
        originalText: 'Test message',
        sourceLanguage: 'en',
        targetLanguage: 'unknown',
        culturalContext: {
          targetCulture: 'invalid-culture',
          educationalLevel: 'middle',
          formalityLevel: 'semi-formal',
          studentAgeGroup: 'teens'
        }
      };
      
      const result = await culturalService.adaptTranslation(culturalOptions);
      
      // Should return original text with some basic adaptations
      expect(result).toContain('Test message');
      expect(result).toContain('[TEEN_APPROPRIATE]');
    });

    it('should handle edge cases in content adaptation', async () => {
      const edgeCases = [
        { text: '', description: 'empty text' },
        { text: 'a', description: 'single character' },
        { text: 'A'.repeat(1000), description: 'very long text' },
        { text: '123 456 789', description: 'numbers only' },
        { text: '!@#$%^&*()', description: 'special characters' }
      ];
      
      for (const testCase of edgeCases) {
        const culturalOptions: CulturalAdaptationOptions = {
          originalText: testCase.text,
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          culturalContext: {
            targetCulture: 'jp',
            educationalLevel: 'middle',
            formalityLevel: 'formal',
            studentAgeGroup: 'teens'
          }
        };
        
        const result = await culturalService.adaptTranslation(culturalOptions);
        
        expect(typeof result).toBe('string');
        // Should still apply cultural context markers
        expect(result).toContain('[FORMAL_CONTEXT]');
      }
    });
  });
});
