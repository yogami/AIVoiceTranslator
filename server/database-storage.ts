import {
  type Session,
  type Translation,
  type InsertUser,
  type InsertLanguage,
  type InsertTranslation,
  type InsertTranscript,
  type InsertSession,
  sessions,
  translations,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  IStorage,
  // StorageError removed as it is not exported
} from "./storage.interface"; // Db storage was importing from storage.ts, now from storage.interface.ts
import { DbUserStorage } from "./storage/user.storage";
import { DbLanguageStorage } from "./storage/language.storage";
import { DbTranslationStorage } from "./storage/translation.storage";
import { DbTranscriptStorage } from "./storage/transcript.storage";
import { DbSessionStorage } from "./storage/session.storage";

export class DatabaseStorage implements IStorage {
  private userStorage: DbUserStorage;
  private languageStorage: DbLanguageStorage;
  private translationStorage: DbTranslationStorage;
  private transcriptStorage: DbTranscriptStorage;
  private sessionStorage: DbSessionStorage;

  constructor() {
    this.userStorage = new DbUserStorage();
    this.languageStorage = new DbLanguageStorage();
    this.translationStorage = new DbTranslationStorage();
    this.transcriptStorage = new DbTranscriptStorage();
    this.sessionStorage = new DbSessionStorage();
  }

  // User methods (delegated)
  async getUser(id: number) { return this.userStorage.getUser(id); }
  async getUserByUsername(username: string) { return this.userStorage.getUserByUsername(username); }
  async createUser(user: InsertUser) { return this.userStorage.createUser(user); }

  // Language methods (delegated)
  async getLanguages() { return this.languageStorage.getLanguages(); }
  async getActiveLanguages() { return this.languageStorage.getActiveLanguages(); }
  async getLanguageByCode(code: string) { return this.languageStorage.getLanguageByCode(code); }
  async createLanguage(language: InsertLanguage) { return this.languageStorage.createLanguage(language); }
  async updateLanguageStatus(code: string, isActive: boolean) { return this.languageStorage.updateLanguageStatus(code, isActive); }

  // Translation methods (delegated)
  async addTranslation(translation: InsertTranslation) { return this.translationStorage.addTranslation(translation); }
  async getTranslationsByLanguage(targetLanguage: string, limit?: number) { return this.translationStorage.getTranslationsByLanguage(targetLanguage, limit); }
  async getTranslations(limit?: number) { return this.translationStorage.getTranslations(limit); }
  async getTranslationsByDateRange(startDate: Date, endDate: Date) { return this.translationStorage.getTranslationsByDateRange(startDate, endDate); }

  // Transcript methods (delegated)
  async addTranscript(transcript: InsertTranscript) { return this.transcriptStorage.addTranscript(transcript); }
  async getTranscriptsBySession(sessionId: string, language: string, limit?: number) { return this.transcriptStorage.getTranscriptsBySession(sessionId, language, limit); }

  // Session methods (delegated)
  async createSession(session: InsertSession) { return this.sessionStorage.createSession(session); }
  async updateSession(sessionId: string, updates: Partial<InsertSession>) { return this.sessionStorage.updateSession(sessionId, updates); }
  async getActiveSession(sessionId: string) { return this.sessionStorage.getActiveSession(sessionId); }
  async getAllActiveSessions() { return this.sessionStorage.getAllActiveSessions(); }
  async endSession(sessionId: string) { return this.sessionStorage.endSession(sessionId); }
  async getRecentSessionActivity(limit?: number) { return this.sessionStorage.getRecentSessionActivity(limit); }

  // Analytics methods
  async getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }> {
    // Fetch translations for the specific session directly from the database
    const translationsForSession: Translation[] = await db.select()
      .from(translations)
      .where(eq(translations.sessionId, sessionId));

    if (translationsForSession.length === 0) {
        return { totalTranslations: 0, averageLatency: 0, languagePairs: [] };
    }

    const totalTranslations = translationsForSession.length;
    const totalLatencySum = translationsForSession.reduce((sum: number, t: Translation) => sum + (t.latency || 0), 0);
    const averageLatency = totalTranslations > 0 ? totalLatencySum / totalTranslations : 0;

    const languagePairsMap = new Map<string, { sourceLanguage: string; targetLanguage: string; count: number }>();
    for (const t of translationsForSession) {
        if (t.sourceLanguage && t.targetLanguage) {
            const key = `${t.sourceLanguage}-${t.targetLanguage}`;
            const pair = languagePairsMap.get(key);
            if (pair) {
                pair.count++;
            } else {
                languagePairsMap.set(key, { sourceLanguage: t.sourceLanguage, targetLanguage: t.targetLanguage, count: 1 });
            }
        }
    }
    return { totalTranslations, averageLatency, languagePairs: Array.from(languagePairsMap.values()) };
  }

  async getSessionMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
  }> {
    let query = db.select().from(sessions).$dynamic();
    if (timeRange) {
      query = db.select().from(sessions)
                .where(and(
                    gte(sessions.startTime, timeRange.startDate),
                    lte(sessions.startTime, timeRange.endDate) 
                )).$dynamic();
    }
    const allSessionsResult: Session[] = await query;
    
    const activeSessionsCountResult = await db.select({ value: sql<number>`count(*)` })
                                      .from(sessions)
                                      .where(eq(sessions.isActive, true));

    const durations = allSessionsResult
      .filter((s: Session) => s.startTime && s.endTime)
      .map((s: Session) => new Date(s.endTime!).getTime() - new Date(s.startTime!).getTime());
    const averageDuration = durations.length > 0 ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length : 0;
    return { 
        totalSessions: allSessionsResult.length, 
        activeSessions: Number(activeSessionsCountResult[0]?.value) || 0, 
        averageSessionDuration: averageDuration 
    };
  }

  async getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number;
  }> {
    let query = db.select().from(translations).$dynamic();
    if (timeRange) {
      query = db.select().from(translations)
                .where(and(
                    gte(translations.timestamp, timeRange.startDate),
                    lte(translations.timestamp, timeRange.endDate)
                )).$dynamic();
    }
    const allTranslationsResult: Translation[] = await query;

    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentTranslationsResult = await db.select({ value: sql<number>`count(*)` })
                                          .from(translations)
                                          .where(gte(translations.timestamp, oneHourAgo));
    
    const totalLatencySum = allTranslationsResult.reduce((sum: number, t: Translation) => sum + (t.latency || 0), 0);
    const avgLatency = allTranslationsResult.length > 0 ? totalLatencySum / allTranslationsResult.length : 0;

    return { 
        totalTranslations: allTranslationsResult.length, 
        averageLatency: avgLatency, 
        recentTranslations: Number(recentTranslationsResult[0]?.value) || 0 
    };
  }

  async getLanguagePairMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }[]> {
    let translationsToAnalyzeQuery = db.select().from(translations).$dynamic();
    if (timeRange) {
        translationsToAnalyzeQuery = db.select().from(translations)
            .where(and(
                gte(translations.timestamp, timeRange.startDate),
                lte(translations.timestamp, timeRange.endDate)
            )).$dynamic();
    }
    const translationsToAnalyze: Translation[] = await translationsToAnalyzeQuery;

    const pairMap = new Map<string, { count: number; totalLatency: number; sourceLanguage: string; targetLanguage: string }>();
    for (const t of translationsToAnalyze) {
      if (t.sourceLanguage && t.targetLanguage) {
        const key = `${t.sourceLanguage}-${t.targetLanguage}`;
        const existing = pairMap.get(key) || { count: 0, totalLatency: 0, sourceLanguage: t.sourceLanguage, targetLanguage: t.targetLanguage };
        pairMap.set(key, { ...existing, count: existing.count + 1, totalLatency: existing.totalLatency + (t.latency || 0) });
      }
    }
    return Array.from(pairMap.values())
      .map(data => ({ 
        sourceLanguage: data.sourceLanguage, 
        targetLanguage: data.targetLanguage, 
        count: data.count, 
        averageLatency: data.count > 0 ? data.totalLatency / data.count : 0 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}
