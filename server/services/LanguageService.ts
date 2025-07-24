/**
 * Language Service
 * 
 * Business logic for language management
 */

import { IStorage } from '../storage.interface.js';

export class LanguageService {
  constructor(private storage: IStorage) {}

  /**
   * Get all available languages
   */
  async getAllLanguages() {
    return await this.storage.getLanguages();
  }

  /**
   * Get only active languages
   */
  async getActiveLanguages() {
    return await this.storage.getActiveLanguages();
  }

  /**
   * Update language status
   */
  async updateLanguageStatus(code: string, isActive: boolean) {
    const updatedLanguage = await this.storage.updateLanguageStatus(code, isActive);
    
    if (!updatedLanguage) {
      throw new Error(`Language with code '${code}' not found`);
    }
    
    return updatedLanguage;
  }
}
