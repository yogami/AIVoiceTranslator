/**
 * Domain Interface: Translation Service
 * 
 * Core domain contract for translation functionality.
 * This interface defines the domain's expectations for text translation
 * without any infrastructure concerns.
 */

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
  provider?: string;
}

export interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  preserveFormatting?: boolean;
}

export interface ITranslationService {
  /**
   * Translate text from source to target language
   * @param text Text to translate
   * @param options Translation options
   * @returns Promise resolving to translation result
   */
  translate(text: string, options: TranslationOptions): Promise<TranslationResult>;

  /**
   * Check if the service is available and healthy
   * @returns Promise resolving to service health status
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the service identifier for logging/monitoring
   * @returns Service name/identifier
   */
  getServiceName(): string;

  /**
   * Get supported language pairs
   * @returns Array of supported language pairs
   */
  getSupportedLanguages(): Promise<string[]>;
}
