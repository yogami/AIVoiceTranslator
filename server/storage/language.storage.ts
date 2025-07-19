import { type Language, type InsertLanguage, languages } from '../../shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { StorageError, StorageErrorCode } from '../storage.error';

export interface ILanguageStorage {
  getLanguage(id: number): Promise<Language | undefined>;
  getLanguageByCode(code: string): Promise<Language | undefined>;
  createLanguage(language: InsertLanguage): Promise<Language>;
  listLanguages(): Promise<Language[]>;
  getLanguages(): Promise<Language[]>; // Added - alias for listLanguages
  getActiveLanguages(): Promise<Language[]>; // Added
  updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined>; // Added
  initializeDefaultLanguages?(): Promise<void>; // Added - optional for interface
}

export class MemLanguageStorage implements ILanguageStorage {
  private languagesMap: Map<number, Language>;
  private idCounter: { value: number };
  private languagesByCodeMap: Map<string, Language>;

  constructor(languagesMap: Map<number, Language>, idCounter: { value: number }) {
    this.languagesMap = languagesMap;
    this.idCounter = idCounter;
    this.languagesByCodeMap = new Map();
    if (this.languagesMap.size > 0) {
        const maxId = Math.max(...Array.from(this.languagesMap.keys()));
        this.idCounter.value = Math.max(this.idCounter.value, maxId + 1);
        this.languagesMap.forEach(lang => this.languagesByCodeMap.set(lang.code, lang));
    }
  }

  async initializeDefaultLanguages(): Promise<void> {
    const defaultLanguages = [
      { code: 'en-US', name: 'English (United States)', isActive: true },
      { code: 'es', name: 'Spanish', isActive: true },
      { code: 'fr', name: 'French', isActive: true },
      { code: 'de', name: 'German', isActive: true },
      { code: 'it', name: 'Italian', isActive: true },
      { code: 'pt', name: 'Portuguese', isActive: true },
      { code: 'ru', name: 'Russian', isActive: true },
      { code: 'ja', name: 'Japanese', isActive: true },
      { code: 'ko', name: 'Korean', isActive: true },
      { code: 'zh', name: 'Chinese (Simplified)', isActive: true }
    ];

    for (const lang of defaultLanguages) {
      if (!this.languagesByCodeMap.has(lang.code)) {
        await this.createLanguage(lang);
      }
    }
  }

  async getLanguage(id: number): Promise<Language | undefined> {
    return this.languagesMap.get(id);
  }

  async getLanguageByCode(code: string): Promise<Language | undefined> {
    return this.languagesByCodeMap.get(code);
  }

  async createLanguage(language: InsertLanguage): Promise<Language> {
    if (!language.code || !language.name) {
      throw new StorageError('Language code and name are required', StorageErrorCode.VALIDATION_ERROR);
    }
    if (this.languagesByCodeMap.has(language.code)) {
      throw new StorageError(`Language with code '${language.code}' already exists`, StorageErrorCode.DUPLICATE_ENTRY);
    }
    const newLanguage: Language = {
      id: this.idCounter.value++,
      code: language.code,
      name: language.name,
      isActive: language.isActive ?? true
    };
    this.languagesMap.set(newLanguage.id, newLanguage);
    this.languagesByCodeMap.set(newLanguage.code, newLanguage);
    return newLanguage;
  }

  async listLanguages(): Promise<Language[]> {
    return Array.from(this.languagesMap.values());
  }

  async getLanguages(): Promise<Language[]> {
    return this.listLanguages();
  }

  async getActiveLanguages(): Promise<Language[]> {
    return Array.from(this.languagesMap.values()).filter(lang => lang.isActive);
  }

  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const language = this.languagesByCodeMap.get(code);
    if (!language) {
      return undefined;
    }
    language.isActive = isActive;
    return language;
  }
}

export class DbLanguageStorage implements ILanguageStorage {
  async getLanguage(id: number): Promise<Language | undefined> {
    const result = await db.select().from(languages).where(eq(languages.id, id)).limit(1);
    return result[0];
  }

  async getLanguageByCode(code: string): Promise<Language | undefined> {
    const result = await db.select().from(languages).where(eq(languages.code, code)).limit(1);
    return result[0];
  }

  async createLanguage(language: InsertLanguage): Promise<Language> {
    if (!language.code || !language.name) {
      throw new StorageError('Language code and name are required for DB language creation', StorageErrorCode.VALIDATION_ERROR);
    }
    try {
        const result = await db.insert(languages).values(language).returning();
        if (!result || result.length === 0) {
            throw new StorageError('Failed to create language in DB, no data returned.', StorageErrorCode.CREATE_FAILED);
        }
        return result[0];
    } catch (error: any) {
        if (error instanceof StorageError) { // If it's already a StorageError (e.g., our CREATE_FAILED)
            throw error; // Re-throw it directly
        }
        if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
             throw new StorageError(`Language with code '${language.code}' already exists in DB.`, StorageErrorCode.DUPLICATE_ENTRY, error);
        }
        // For other types of errors, wrap them
        throw new StorageError('Error creating language in DB.', StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async listLanguages(): Promise<Language[]> {
    return db.select().from(languages);
  }

  async getLanguages(): Promise<Language[]> {
    return this.listLanguages();
  }

  async getActiveLanguages(): Promise<Language[]> {
    return db.select().from(languages).where(eq(languages.isActive, true));
  }

  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const result = await db.update(languages)
      .set({ isActive })
      .where(eq(languages.code, code))
      .returning();
    return result[0];
  }

  async initializeDefaultLanguages(): Promise<void> { // Added
    const defaultLanguagesData = [
      { code: 'en-US', name: 'English (United States)', isActive: true },
      { code: 'es', name: 'Spanish', isActive: true },
      { code: 'fr', name: 'French', isActive: true },
      { code: 'de', name: 'German', isActive: true },
      { code: 'it', name: 'Italian', isActive: true },
      { code: 'pt', name: 'Portuguese', isActive: true },
      { code: 'ru', name: 'Russian', isActive: true },
      { code: 'ja', name: 'Japanese', isActive: true },
      { code: 'ko', name: 'Korean', isActive: true },
      { code: 'zh', name: 'Chinese (Simplified)', isActive: true }
    ];

    for (const langData of defaultLanguagesData) {
      try {
        // Try to create the language, ignoring duplicate key errors
        await this.createLanguage(langData);
      } catch (error: any) {
        // Check if it's a duplicate key error
        if (error?.code === '23505' || error?.details?.code === '23505' || 
            (error?.code === 'DUPLICATE_ENTRY' && error?.details?.code === '23505')) {
          // Language already exists, continue to next
          continue;
        } else {
          // Some other error occurred, log it but continue
          console.error(`Failed to insert default language ${langData.code}:`, error);
        }
      }
    }
  }
}