/**
 * Translation Service
 * 
 * Handles text translation between languages using OpenAI API
 */
import OpenAI from 'openai';

export class TranslationService {
  private openai: OpenAI;
  // Cache for common translations to reduce API calls
  private translationCache: Map<string, string> = new Map();
  
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  /**
   * Translate text from source language to target language
   */
  public async translateText(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<string> {
    try {
      // Skip translation if languages are the same
      if (sourceLanguage.split('-')[0] === targetLanguage.split('-')[0]) {
        return text;
      }
      
      // Generate cache key
      const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
      
      // Check cache first
      if (this.translationCache.has(cacheKey)) {
        return this.translationCache.get(cacheKey)!;
      }
      
      // Perform translation using OpenAI
      const translatedText = await this.translateWithOpenAI(text, sourceLanguage, targetLanguage);
      
      // Cache the result
      this.translationCache.set(cacheKey, translatedText);
      
      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return ''; // Return empty string on error
    }
  }
  
  /**
   * Translate text to multiple target languages at once
   */
  public async translateTextToMultipleLanguages(
    text: string,
    sourceLanguage: string,
    targetLanguages: string[]
  ): Promise<Record<string, string>> {
    try {
      // Create a map of results
      const results: Record<string, string> = {};
      
      // Process translations in parallel
      const translations = await Promise.all(
        targetLanguages.map(async (targetLanguage) => {
          const translation = await this.translateText(text, sourceLanguage, targetLanguage);
          return { targetLanguage, translation };
        })
      );
      
      // Convert array to record
      translations.forEach(({ targetLanguage, translation }) => {
        results[targetLanguage] = translation;
      });
      
      return results;
    } catch (error) {
      console.error('Multiple translation error:', error);
      return {}; // Return empty object on error
    }
  }
  
  /**
   * Perform translation using OpenAI API
   */
  private async translateWithOpenAI(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      // Extract base language codes without region
      const sourceBase = sourceLanguage.split('-')[0];
      const targetBase = targetLanguage.split('-')[0];
      
      // Get language names for better prompting
      const sourceLangName = this.getLanguageName(sourceBase);
      const targetLangName = this.getLanguageName(targetBase);
      
      // Create translation prompt
      const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}. 
Maintain the original meaning, tone, and style as closely as possible.
Preserve formatting like line breaks and emphasis.
For terminology, prioritize accuracy over literal translation.

Text to translate:
"${text}"

Translation (${targetLangName}):`;
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: 'system', content: 'You are a professional translator with expertise in multiple languages.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent translations
        max_tokens: 1024,
      });
      
      // Extract translated text from response
      const translatedText = response.choices[0].message.content?.trim() || '';
      
      // Remove quotes if present (sometimes the API returns the text in quotes)
      return translatedText.replace(/^"(.*)"$/, '$1');
    } catch (error) {
      console.error('OpenAI translation error:', error);
      throw error;
    }
  }
  
  /**
   * Get language name from ISO code
   */
  private getLanguageName(languageCode: string): string {
    const languageMap: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'bn': 'Bengali',
      'ur': 'Urdu',
      'tr': 'Turkish',
      'pl': 'Polish',
      'uk': 'Ukrainian',
      'vi': 'Vietnamese',
      'th': 'Thai'
    };
    
    return languageMap[languageCode] || 'Unknown';
  }
}