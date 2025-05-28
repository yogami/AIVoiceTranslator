import {
  users,
  type User,
  type InsertUser,
  languages,
  type Language,
  type InsertLanguage,
  translations,
  type Translation,
  type InsertTranslation,
  transcripts,
  type Transcript,
  type InsertTranscript
} from "../shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Language methods
  getLanguages(): Promise<Language[]>;
  getActiveLanguages(): Promise<Language[]>;
  getLanguageByCode(code: string): Promise<Language | undefined>;
  createLanguage(language: InsertLanguage): Promise<Language>;
  updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined>;
  
  // Translation methods
  addTranslation(translation: InsertTranslation): Promise<Translation>;
  getTranslationsByLanguage(targetLanguage: string, limit?: number): Promise<Translation[]>;
  
  // Transcript methods
  addTranscript(transcript: InsertTranscript): Promise<Transcript>;
  getTranscriptsBySession(sessionId: string, language: string): Promise<Transcript[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private languages: Map<number, Language>;
  private translations: Map<number, Translation>;
  private transcripts: Map<number, Transcript>;
  
  private userId: number;
  private languageId: number;
  private translationId: number;
  private transcriptId: number;

  constructor() {
    this.users = new Map();
    this.languages = new Map();
    this.translations = new Map();
    this.transcripts = new Map();
    
    this.userId = 1;
    this.languageId = 1;
    this.translationId = 1;
    this.transcriptId = 1;
    
    // Initialize with default languages
    this.initializeDefaultLanguages();
  }

  private initializeDefaultLanguages() {
    const defaultLanguages: InsertLanguage[] = [
      { code: "en-US", name: "English (United States)", isActive: true },
      { code: "es", name: "Spanish", isActive: true },
      { code: "de", name: "German", isActive: true },
      { code: "fr", name: "French", isActive: true }
    ];
    
    defaultLanguages.forEach(lang => {
      this.createLanguage(lang);
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Language methods
  async getLanguages(): Promise<Language[]> {
    return Array.from(this.languages.values());
  }
  
  async getActiveLanguages(): Promise<Language[]> {
    return Array.from(this.languages.values()).filter(lang => lang.isActive);
  }
  
  async getLanguageByCode(code: string): Promise<Language | undefined> {
    return Array.from(this.languages.values()).find(lang => lang.code === code);
  }
  
  async createLanguage(insertLanguage: InsertLanguage): Promise<Language> {
    const id = this.languageId++;
    const language: Language = { 
      ...insertLanguage, 
      id, 
      isActive: insertLanguage.isActive ?? true 
    };
    this.languages.set(id, language);
    return language;
  }
  
  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const language = await this.getLanguageByCode(code);
    if (!language) return undefined;
    
    const updatedLanguage: Language = { ...language, isActive };
    this.languages.set(language.id, updatedLanguage);
    return updatedLanguage;
  }
  
  // Translation methods
  async addTranslation(insertTranslation: InsertTranslation): Promise<Translation> {
    const id = this.translationId++;
    const timestamp = new Date();
    const translation: Translation = { 
      ...insertTranslation, 
      id, 
      timestamp,
      latency: insertTranslation.latency ?? null
    };
    this.translations.set(id, translation);
    return translation;
  }
  
  async getTranslationsByLanguage(targetLanguage: string, limit = 10): Promise<Translation[]> {
    return Array.from(this.translations.values())
      .filter(t => t.targetLanguage === targetLanguage)
      .sort((a, b) => {
        // Handle possible null timestamps
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, limit);
  }
  
  // Transcript methods
  async addTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    const id = this.transcriptId++;
    const timestamp = new Date();
    const transcript: Transcript = { ...insertTranscript, id, timestamp };
    this.transcripts.set(id, transcript);
    return transcript;
  }
  
  async getTranscriptsBySession(sessionId: string, language: string): Promise<Transcript[]> {
    return Array.from(this.transcripts.values())
      .filter(t => t.sessionId === sessionId && t.language === language)
      .sort((a, b) => {
        // Handle possible null timestamps
        if (!a.timestamp) return -1;
        if (!b.timestamp) return 1;
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
  }
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }
  
  // Language methods
  async getLanguages(): Promise<Language[]> {
    return await db.select().from(languages);
  }
  
  async getActiveLanguages(): Promise<Language[]> {
    return await db.select().from(languages).where(eq(languages.isActive, true));
  }
  
  async getLanguageByCode(code: string): Promise<Language | undefined> {
    const result = await db.select().from(languages).where(eq(languages.code, code));
    return result[0];
  }
  
  async createLanguage(insertLanguage: InsertLanguage): Promise<Language> {
    const result = await db.insert(languages).values(insertLanguage).returning();
    return result[0];
  }
  
  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const result = await db.update(languages)
      .set({ isActive })
      .where(eq(languages.code, code))
      .returning();
    return result[0];
  }
  
  // Translation methods
  async addTranslation(insertTranslation: InsertTranslation): Promise<Translation> {
    const result = await db.insert(translations).values(insertTranslation).returning();
    return result[0];
  }
  
  async getTranslationsByLanguage(targetLanguage: string, limit = 10): Promise<Translation[]> {
    return await db.select()
      .from(translations)
      .where(eq(translations.targetLanguage, targetLanguage))
      .limit(limit);
  }
  
  // Transcript methods
  async addTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    const result = await db.insert(transcripts).values(insertTranscript).returning();
    return result[0];
  }
  
  async getTranscriptsBySession(sessionId: string, language: string): Promise<Transcript[]> {
    return await db.select()
      .from(transcripts)
      .where(and(eq(transcripts.sessionId, sessionId), eq(transcripts.language, language)));
  }
}

// Use MemStorage for in-memory storage (no database required)
export const storage = new MemStorage();
