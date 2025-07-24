/**
 * Translation Routes Service
 * 
 * Business logic for translation route management (separate from OpenAI TranslationService)
 */

import { IStorage } from '../storage.interface.js';

export interface TranslationRouteData {
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
  translatedText: string;
  latency?: number;
}

export class TranslationRoutesService {
  constructor(private storage: IStorage) {}

  /**
   * Save a new translation
   */
  async saveTranslation(data: TranslationRouteData) {
    // Validation
    if (data.originalText.trim().length === 0) {
      throw new Error('originalText cannot be empty');
    }

    if (data.translatedText.trim().length === 0) {
      throw new Error('translatedText cannot be empty');
    }

    const translation = await this.storage.addTranslation({
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      originalText: data.originalText.trim(),
      translatedText: data.translatedText.trim(),
      latency: data.latency || 0
    });

    return translation;
  }

  /**
   * Get translations by target language
   */
  async getTranslationsByLanguage(language: string, limit?: number) {
    return await this.storage.getTranslationsByLanguage(language, limit);
  }
}
