import { type Translation, type InsertTranslation, translations } from "../../shared/schema";
import { db } from "../db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { StorageError, StorageErrorCode } from "../storage.error";

const DEFAULT_TRANSLATION_QUERY_LIMIT = 10;

export interface ITranslationStorage {
  getTranslation(id: number): Promise<Translation | undefined>;
  createTranslation(translation: InsertTranslation): Promise<Translation>;
  addTranslation(translation: InsertTranslation): Promise<Translation>; // Alias for createTranslation
  getTranslationsByLanguage(targetLanguage: string, limit?: number): Promise<Translation[]>;
  getTranslations(limit?: number, offset?: number): Promise<Translation[]>; // Added offset parameter
  getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]>;
}

export class MemTranslationStorage implements ITranslationStorage {
  private translationsMap: Map<number, Translation>;
  private idCounter: { value: number };

  constructor(translationsMap: Map<number, Translation>, idCounter: { value: number }) {
    this.translationsMap = translationsMap;
    this.idCounter = idCounter;
    if (this.translationsMap.size > 0) {
        const maxId = Math.max(...Array.from(this.translationsMap.keys()));
        this.idCounter.value = Math.max(this.idCounter.value, maxId + 1);
    }
  }

  async getTranslation(id: number): Promise<Translation | undefined> {
    return this.translationsMap.get(id);
  }

  async createTranslation(translation: InsertTranslation): Promise<Translation> {
    const newTranslation: Translation = {
      id: this.idCounter.value++,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      originalText: translation.originalText,
      translatedText: translation.translatedText,
      timestamp: new Date(),
      sessionId: (translation as any).sessionId || null,
      latency: translation.latency || null
    };
    this.translationsMap.set(newTranslation.id, newTranslation);
    return newTranslation;
  }

  async addTranslation(translation: InsertTranslation): Promise<Translation> {
    const id = this.idCounter.value++;
    const now = new Date();
    const newTranslation: Translation = {
      id,
      ...translation,
      timestamp: translation.timestamp || now,  // Use provided timestamp or current time
      sessionId: translation.sessionId || null,
      latency: translation.latency || null,
    };
    
    this.translationsMap.set(id, newTranslation);
    return newTranslation;
  }

  async getTranslationsByLanguage(targetLanguage: string, limit: number = DEFAULT_TRANSLATION_QUERY_LIMIT): Promise<Translation[]> {
    const results: Translation[] = [];
    for (const translation of this.translationsMap.values()) {
      if (translation.targetLanguage === targetLanguage) {
        results.push(translation);
      }
      if (results.length >= limit) break;
    }
    return results;
  }

  async getTranslations(limit: number = DEFAULT_TRANSLATION_QUERY_LIMIT, offset: number = 0): Promise<Translation[]> { // Added offset parameter
    return Array.from(this.translationsMap.values())
      .sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      })
      .slice(offset, offset + limit); // Use offset in slice
  }

  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    return Array.from(this.translationsMap.values()).filter(t => {
      if (!t.timestamp) return false;
      const timestamp = new Date(t.timestamp).getTime();
      return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
    });
  }
}

export class DbTranslationStorage implements ITranslationStorage {
  async getTranslation(id: number): Promise<Translation | undefined> {
    const result = await db.select().from(translations).where(eq(translations.id, id)).limit(1);
    return result[0];
  }

  async createTranslation(translation: InsertTranslation): Promise<Translation> {
    try {
      // Reverted: No longer deleting sessionId or latency.
      // Drizzle will attempt to insert all fields from the 'translation' object.
      // If columns are missing in the DB, this will likely throw an error,
      // which is the correct behavior if the DB schema is out of sync.
      const result = await db.insert(translations).values(translation).returning();
      if (!result || result.length === 0) {
        throw new StorageError('No data returned after insert operation.', StorageErrorCode.DB_INSERT_FAILED);
      }
      return result[0];
    } catch (error: any) {
      if (error instanceof StorageError) {
        throw error;
      }
      // Check for PostgreSQL unique constraint violation (error code 23505)
      // or SQLite unique constraint violation (error message includes UNIQUE constraint failed)
      if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique constraint failed'))) {
        // Attempt to identify which constraint failed if possible, though the error message is generic here.
        // For a more robust solution, you might need to parse error.constraint_name if available
        // or rely on more specific error details if your DB driver provides them.
        let field = 'unknown';
        if (error.message && error.message.includes(translations.id.name)) { // translations_pkey or similar
            field = 'id';
        } else if (error.message && error.message.includes('originalText_targetLanguage_unique')) { // Example, if such a constraint exists
            field = 'originalText_targetLanguage';
        }
        throw new StorageError(`Duplicate entry for ${field}.`, StorageErrorCode.DUPLICATE_ENTRY, error);
      }
      throw new StorageError(`Database error: ${error.message}`, StorageErrorCode.DB_ERROR, error);
    }
  }

  async addTranslation(translation: InsertTranslation): Promise<Translation> {
    return this.createTranslation(translation);
  }

  async getTranslationsByLanguage(targetLanguage: string, limit: number = DEFAULT_TRANSLATION_QUERY_LIMIT): Promise<Translation[]> {
    return db.select()
      .from(translations)
      .where(eq(translations.targetLanguage, targetLanguage))
      .orderBy(desc(translations.timestamp))
      .limit(limit);
  }

  async getTranslations(limit: number = DEFAULT_TRANSLATION_QUERY_LIMIT, offset: number = 0): Promise<Translation[]> { // Added offset parameter
    return db.select()
      .from(translations)
      .orderBy(desc(translations.timestamp))
      .limit(limit)
      .offset(offset); // Use offset in query
  }

  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    return db.select()
      .from(translations)
      .where(and(
        gte(translations.timestamp, startDate),
        lte(translations.timestamp, endDate)
      ))
      .orderBy(desc(translations.timestamp));
  }
}