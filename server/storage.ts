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

// In production, use the DatabaseStorage implementation
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Language methods
  async getLanguages(): Promise<Language[]> {
    return db.select().from(languages);
  }
  
  async getActiveLanguages(): Promise<Language[]> {
    return db.select().from(languages).where(eq(languages.isActive, true));
  }
  
  async getLanguageByCode(code: string): Promise<Language | undefined> {
    const [language] = await db.select().from(languages).where(eq(languages.code, code));
    return language || undefined;
  }
  
  async createLanguage(insertLanguage: InsertLanguage): Promise<Language> {
    const [language] = await db
      .insert(languages)
      .values(insertLanguage)
      .returning();
    return language;
  }
  
  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const [updatedLanguage] = await db
      .update(languages)
      .set({ isActive })
      .where(eq(languages.code, code))
      .returning();
    return updatedLanguage || undefined;
  }
  
  // Translation methods
  async addTranslation(insertTranslation: InsertTranslation): Promise<Translation> {
    const [translation] = await db
      .insert(translations)
      .values(insertTranslation)
      .returning();
    return translation;
  }
  
  async getTranslationsByLanguage(targetLanguage: string, limit = 10): Promise<Translation[]> {
    return db
      .select()
      .from(translations)
      .where(eq(translations.targetLanguage, targetLanguage))
      .orderBy(desc(translations.timestamp))
      .limit(limit);
  }
  
  // Transcript methods
  async addTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    const [transcript] = await db
      .insert(transcripts)
      .values(insertTranscript)
      .returning();
    return transcript;
  }
  
  async getTranscriptsBySession(sessionId: string, language: string): Promise<Transcript[]> {
    return db
      .select()
      .from(transcripts)
      .where(
        and(
          eq(transcripts.sessionId, sessionId),
          eq(transcripts.language, language)
        )
      )
      .orderBy(transcripts.timestamp);
  }
}

// Replace MemStorage with DatabaseStorage since we've set up the PostgreSQL database
export const storage = new DatabaseStorage();
