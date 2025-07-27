/**
 * MyMemory Translation Service
 * 
 * Free translation service using MyMemory API (https://mymemory.translated.net/)
 * This serves as a fallback alternative to OpenAI Translation API
 * 
 * MyMemory API Features:
 * - 10,000 free translations per day
 * - No API key required for basic usage
 * - Supports 100+ language pairs
 * - Human-quality translations from professional translators
 */

import { ITranslationService } from '../TranslationService.js';

// Language code mapping from our format to MyMemory format
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'en-US': 'en',
  'fr-FR': 'fr',
  'es-ES': 'es',
  'de-DE': 'de',
  'it-IT': 'it',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'pt-BR': 'pt',
  'ru-RU': 'ru',
  'zh-CN': 'zh',
  'ar-SA': 'ar',
  'hi-IN': 'hi',
  'tr-TR': 'tr',
  'nl-NL': 'nl',
  'pl-PL': 'pl',
  'sv-SE': 'sv',
  'da-DK': 'da',
  'fi-FI': 'fi',
  'no-NO': 'no',
  'cs-CZ': 'cs',
  'hu-HU': 'hu',
  'el-GR': 'el',
  'he-IL': 'he',
  'th-TH': 'th',
  'vi-VN': 'vi',
  'id-ID': 'id',
  'ms-MY': 'ms',
  'ro-RO': 'ro',
  'uk-UA': 'uk',
  'bg-BG': 'bg',
  'hr-HR': 'hr',
  'sr-RS': 'sr',
  'sk-SK': 'sk',
  'sl-SI': 'sl',
  'et-EE': 'et',
  'lv-LV': 'lv',
  'lt-LT': 'lt'
};

interface MyMemoryResponse {
  responseData: {
    translatedText: string;
    match: number;
  };
  quotaFinished: boolean;
  mtLangSupported: boolean;
  responseDetails: string;
  responseStatus: number;
  responderId: string;
  exception_code?: string;
  matches: Array<{
    id: string;
    segment: string;
    translation: string;
    source: string;
    target: string;
    quality: string;
    reference: string;
    'usage-count': number;
    subject: string;
    'created-by': string;
    'last-updated-by': string;
    'create-date': string;
    'last-update-date': string;
    match: number;
  }>;
}

/**
 * MyMemory Translation Service
 * Free translation service that doesn't require an API key
 */
export class MyMemoryTranslationService implements ITranslationService {
  private readonly baseUrl = 'https://api.mymemory.translated.net/get';
  private readonly maxRetries = 3;
  
  constructor() {
    console.log('[MyMemory] Translation service initialized');
  }
  
  /**
   * Convert our language codes to MyMemory format
   */
  private getLanguageCode(languageCode: string): string {
    return LANGUAGE_CODE_MAP[languageCode] || languageCode.split('-')[0];
  }
  
  /**
   * Build the API URL for MyMemory
   */
  private buildApiUrl(text: string, sourceLanguage: string, targetLanguage: string): string {
    const sourceLang = this.getLanguageCode(sourceLanguage);
    const targetLang = this.getLanguageCode(targetLanguage);
    
    const params = new URLSearchParams({
      q: text,
      langpair: `${sourceLang}|${targetLang}`
    });
    
    return `${this.baseUrl}?${params.toString()}`;
  }
  
  /**
   * Handle API errors in a standardized way
   */
  private handleApiError(error: unknown, text: string, retryCount: number): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MyMemory] Translation error [attempt ${retryCount + 1}/${this.maxRetries + 1}]:`, errorMessage);
    
    if (retryCount >= this.maxRetries) {
      throw new Error(`MyMemory translation failed after ${this.maxRetries + 1} attempts: ${errorMessage}`);
    }
  }
  
  /**
   * Execute translation request with retry logic
   */
  private async executeWithRetry(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    retryCount: number = 0
  ): Promise<string> {
    try {
      const url = this.buildApiUrl(text, sourceLanguage, targetLanguage);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'AIVoiceTranslator/1.0 (Educational Purpose)',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: MyMemoryResponse = await response.json();
      
      // Check for API-level errors
      if (data.exception_code) {
        throw new Error(`MyMemory API error: ${data.exception_code}`);
      }
      
      if (data.responseStatus !== 200) {
        throw new Error(`MyMemory response error: ${data.responseDetails}`);
      }
      
      // Check if quota is finished
      if (data.quotaFinished) {
        throw new Error('MyMemory daily quota exceeded');
      }
      
      // Extract the translation
      const translatedText = data.responseData?.translatedText?.trim();
      
      if (!translatedText) {
        console.warn(`[MyMemory] Empty translation response for: "${text}"`);
        return text; // Return original text if no translation available
      }
      
      console.log(`[MyMemory] Translation completed (quality: ${data.responseData.match}%):`, 
        `"${text}" -> "${translatedText}"`);
      
      return translatedText;
      
    } catch (error) {
      this.handleApiError(error, text, retryCount);
      
      // Implement exponential backoff retry
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`[MyMemory] Retrying translation in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.executeWithRetry(text, sourceLanguage, targetLanguage, retryCount + 1);
    }
  }
  
  /**
   * Translate text from one language to another
   * Implementation of ITranslationService interface
   */
  async translate(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<string> {
    // Skip translation for empty text
    if (!text || text.trim().length === 0) {
      return '';
    }
    
    // If target language is the same as source language, no translation needed
    if (targetLanguage === sourceLanguage) {
      console.log(`[MyMemory] No translation needed - source and target language are the same (${targetLanguage})`);
      return text;
    }
    
    // Check if text is too long (MyMemory has a 500 character limit per request)
    if (text.length > 500) {
      console.warn(`[MyMemory] Text too long (${text.length} chars), truncating to 500 characters`);
      text = text.substring(0, 500);
    }
    
    try {
      const translatedText = await this.executeWithRetry(text, sourceLanguage, targetLanguage);
      
      console.log(`[MyMemory] Successfully translated from ${sourceLanguage} to ${targetLanguage}`);
      return translatedText;
      
    } catch (error: unknown) {
      console.error(`[MyMemory] Translation failed for ${sourceLanguage} -> ${targetLanguage}:`, error);
      
      // For production, we'd log this error to a monitoring system
      if (error instanceof Error) {
        console.error(`[MyMemory] Translation error details: ${error.message}`);
      }
      
      // Return empty string to indicate failure, consistent with OpenAI service behavior
      return '';
    }
  }
}
