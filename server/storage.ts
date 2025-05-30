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
  type InsertTranscript,
  sessions,
  type Session,
  type InsertSession
} from "../shared/schema";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";

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
  
  // Session methods
  createSession(session: InsertSession): Promise<Session>;
  updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined>;
  getActiveSession(sessionId: string): Promise<Session | undefined>;
  getAllActiveSessions(): Promise<Session[]>;
  endSession(sessionId: string): Promise<Session | undefined>;
  
  // Analytics methods
  getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]>;
  getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private languages: Map<number, Language>;
  private translations: Map<number, Translation>;
  private transcripts: Map<number, Transcript>;
  private sessions: Map<number, Session>;
  
  private userId: number;
  private languageId: number;
  private translationId: number;
  private transcriptId: number;
  private sessionId: number;

  constructor() {
    this.users = new Map();
    this.languages = new Map();
    this.translations = new Map();
    this.transcripts = new Map();
    this.sessions = new Map();
    
    this.userId = 1;
    this.languageId = 1;
    this.translationId = 1;
    this.transcriptId = 1;
    this.sessionId = 1;
    
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
  
  // Session methods
  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.sessionId++;
    const session: Session = { 
      id,
      sessionId: insertSession.sessionId,
      teacherLanguage: insertSession.teacherLanguage ?? null,
      startTime: new Date(),
      endTime: null,
      studentsCount: insertSession.studentsCount ?? null,
      totalTranslations: insertSession.totalTranslations ?? null,
      averageLatency: insertSession.averageLatency ?? null,
      isActive: insertSession.isActive ?? true
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const session = Array.from(this.sessions.values()).find(s => s.sessionId === sessionId);
    if (!session) return undefined;
    
    const updatedSession: Session = { ...session, ...updates };
    this.sessions.set(session.id, updatedSession);
    return updatedSession;
  }

  async getActiveSession(sessionId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.sessionId === sessionId && s.isActive);
  }

  async getAllActiveSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  async endSession(sessionId: string): Promise<Session | undefined> {
    const session = await this.getActiveSession(sessionId);
    if (!session) return undefined;
    
    const updatedSession: Session = { 
      ...session, 
      endTime: new Date(), 
      isActive: false 
    };
    this.sessions.set(session.id, updatedSession);
    return updatedSession;
  }

  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    return Array.from(this.translations.values()).filter(t => 
      t.timestamp && t.timestamp >= startDate && t.timestamp <= endDate
    );
  }

  async getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }> {
    // Get transcripts for this session
    const sessionTranscripts = Array.from(this.transcripts.values())
      .filter(t => t.sessionId === sessionId);
    
    // For now, return basic analytics - in real implementation, you'd join with translations
    return {
      totalTranslations: sessionTranscripts.length,
      averageLatency: 1500, // Mock average
      languagePairs: [
        { sourceLanguage: 'en-US', targetLanguage: 'es', count: sessionTranscripts.length }
      ]
    };
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
  
  // Session methods
  async createSession(insertSession: InsertSession): Promise<Session> {
    const result = await db.insert(sessions).values(insertSession).returning();
    return result[0];
  }

  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const result = await db.update(sessions)
      .set(updates)
      .where(eq(sessions.sessionId, sessionId))
      .returning();
    return result[0];
  }

  async getActiveSession(sessionId: string): Promise<Session | undefined> {
    const result = await db.select()
      .from(sessions)
      .where(and(eq(sessions.sessionId, sessionId), eq(sessions.isActive, true)));
    return result[0];
  }

  async getAllActiveSessions(): Promise<Session[]> {
    return await db.select()
      .from(sessions)
      .where(eq(sessions.isActive, true));
  }

  async endSession(sessionId: string): Promise<Session | undefined> {
    const result = await db.update(sessions)
      .set({ endTime: new Date(), isActive: false })
      .where(eq(sessions.sessionId, sessionId))
      .returning();
    return result[0];
  }

  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    return await db.select()
      .from(translations)
      .where(and(
        gte(translations.timestamp, startDate),
        lte(translations.timestamp, endDate)
      ));
  }

  async getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }> {
    // Complex query to get session analytics
    const sessionTranslations = await db.select()
      .from(translations)
      .innerJoin(transcripts, eq(transcripts.sessionId, sessionId));
    
    // Calculate metrics
    const totalTranslations = sessionTranslations.length;
    const averageLatency = sessionTranslations.reduce((sum, row) => sum + (row.translations.latency || 0), 0) / totalTranslations;
    
    // Group by language pairs
    const languagePairs = sessionTranslations.reduce((acc, row) => {
      const key = `${row.translations.sourceLanguage}-${row.translations.targetLanguage}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTranslations,
      averageLatency: Math.round(averageLatency),
      languagePairs: Object.entries(languagePairs).map(([key, count]) => {
        const [sourceLanguage, targetLanguage] = key.split('-');
        return { sourceLanguage, targetLanguage, count };
      })
    };
  }
}

// Use MemStorage for in-memory storage (no database required)
export const storage = new MemStorage();
