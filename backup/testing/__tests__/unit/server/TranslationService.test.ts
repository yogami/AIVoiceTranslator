/**
 * Tests for TranslationService
 * 
 * This tests the translation service that handles converting text between languages
 */
import { TranslationService } from '../../../server/services/TranslationService';

// Mock OpenAI API
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Hola mundo'
                }
              }]
            })
          }
        }
      };
    })
  };
});

describe('TranslationService', () => {
  test('should create an instance', () => {
    const service = new TranslationService();
    expect(service).toBeDefined();
  });
  
  test('should translate text to the target language', async () => {
    const service = new TranslationService();
    const result = await service.translateText('Hello world', 'en-US', 'es-ES');
    
    expect(result).toBe('Hola mundo');
  });
  
  test('should handle multiple target languages', async () => {
    const service = new TranslationService();
    
    // Set up mock to return different translations for different languages
    const mockTranslate = jest.spyOn(service as any, 'translateWithOpenAI');
    mockTranslate.mockImplementation((text, sourceLang, targetLang) => {
      if (targetLang === 'es-ES') return Promise.resolve('Hola mundo');
      if (targetLang === 'fr-FR') return Promise.resolve('Bonjour le monde');
      return Promise.resolve('');
    });
    
    const results = await service.translateTextToMultipleLanguages(
      'Hello world', 
      'en-US', 
      ['es-ES', 'fr-FR']
    );
    
    expect(results).toEqual({
      'es-ES': 'Hola mundo',
      'fr-FR': 'Bonjour le monde'
    });
  });
  
  test('should handle errors during translation', async () => {
    const service = new TranslationService();
    
    // Mock an error
    const mockTranslate = jest.spyOn(service as any, 'translateWithOpenAI');
    mockTranslate.mockRejectedValue(new Error('API error'));
    
    // Error should be caught and logged, with empty string returned
    const result = await service.translateText('Hello world', 'en-US', 'es-ES');
    expect(result).toBe('');
  });
});