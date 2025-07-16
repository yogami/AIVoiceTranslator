import {
  type User, users, insertUserSchema,
  type Session, sessions, type InsertSession,
  type Translation, translations, type InsertTranslation,
  type Language, languages, type InsertLanguage, // Added languages table object
  type Transcript, transcripts as transcriptsTable, type InsertTranscript // Added transcripts table object and aliased to avoid conflict
} from '../shared/schema';
import { z } from 'zod';
import { StorageError, StorageErrorCode } from './storage.error';
import { IStorage } from './storage.interface';
import logger from './logger';
import { avg, count, desc, eq, gte, lte, and, sql, isNotNull } from 'drizzle-orm';
import { db as drizzleDB } from './db';



// Import sub-storage classes
import { DbUserStorage } from './storage/user.storage';
import { DbLanguageStorage } from './storage/language.storage';
import { DbTranslationStorage } from './storage/translation.storage';
import { DbTranscriptStorage } from './storage/transcript.storage';
import { DbSessionStorage } from './storage/session.storage';
import type { SessionActivity } from './storage/session.storage'; // Import SessionActivity from session.storage

export class DatabaseStorage implements IStorage {
  private userStorage: DbUserStorage;
  private languageStorage: DbLanguageStorage;
  private translationStorage: DbTranslationStorage;
  private transcriptStorage: DbTranscriptStorage;
  private sessionStorage: DbSessionStorage;
  private initialized: boolean = false;

  constructor() {
    this.userStorage = new DbUserStorage();
    this.languageStorage = new DbLanguageStorage();
    this.translationStorage = new DbTranslationStorage();
    this.transcriptStorage = new DbTranscriptStorage();
    this.sessionStorage = new DbSessionStorage();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.languageStorage.initializeDefaultLanguages();
      this.initialized = true;
    }
  }

  // User methods (delegated)
  async getUser(id: number) { return this.userStorage.getUser(id); }
  async getUserByUsername(username: string) { return this.userStorage.getUserByUsername(username); }
  async createUser(user: z.infer<typeof insertUserSchema>) { return this.userStorage.createUser(user); }
  async listUsers(): Promise<User[]> {
    return this.userStorage.listUsers();
  }

  // Language methods (delegated)
  async getLanguage(id: number): Promise<Language | undefined> {
    await this.ensureInitialized();
    return this.languageStorage.getLanguage(id);
  }
  async getLanguages() { 
    await this.ensureInitialized();
    return this.languageStorage.getLanguages(); 
  }
  async getActiveLanguages() { 
    await this.ensureInitialized();
    return this.languageStorage.getActiveLanguages(); 
  }
  async getLanguageByCode(code: string) { 
    await this.ensureInitialized();
    return this.languageStorage.getLanguageByCode(code); 
  }
  async createLanguage(language: InsertLanguage) { 
    await this.ensureInitialized();
    return this.languageStorage.createLanguage(language); 
  }
  async updateLanguageStatus(code: string, isActive: boolean) { 
    await this.ensureInitialized();
    return this.languageStorage.updateLanguageStatus(code, isActive); 
  }
  async listLanguages(): Promise<Language[]> {
    await this.ensureInitialized();
    return this.languageStorage.listLanguages();
  }
  async initializeDefaultLanguages(): Promise<void> {
    await this.languageStorage.initializeDefaultLanguages();
  }

  // Translation methods
  async getTranslation(id: number): Promise<Translation | undefined> {
    return this.translationStorage.getTranslation(id);
  }
  async addTranslation(translation: InsertTranslation) { 
    const savedTranslation = await this.translationStorage.addTranslation(translation);
    
    // If this translation is associated with a session, increment the totalTranslations count
    if (translation.sessionId) {
      const currentSession = await this.sessionStorage.getSessionById(translation.sessionId);
      if (currentSession) {
        await this.sessionStorage.updateSession(translation.sessionId, {
          totalTranslations: (currentSession.totalTranslations || 0) + 1
        });
      }
    }
    
    return savedTranslation;
  }
  async getTranslationsByLanguage(targetLanguage: string, limit?: number) { return this.translationStorage.getTranslationsByLanguage(targetLanguage, limit); }
  async getTranslations(limit?: number, offset?: number): Promise<Translation[]> {
     return this.translationStorage.getTranslations(limit, offset);
  }
  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    return this.translationStorage.getTranslationsByDateRange(startDate, endDate);
  }

  // Transcript methods (delegated)
  async addTranscript(transcript: InsertTranscript) { return this.transcriptStorage.addTranscript(transcript); }
  async getTranscriptsBySession(sessionId: string, language: string, limit?: number) { return this.transcriptStorage.getTranscriptsBySession(sessionId, language, limit); }

  // Session methods
  async getActiveSession(sessionId: string) { return this.sessionStorage.getActiveSession(sessionId); }
  async getAllActiveSessions() { return this.sessionStorage.getAllActiveSessions(); }
  async getCurrentlyActiveSessions() { return this.sessionStorage.getCurrentlyActiveSessions(); }
  async endSession(sessionId: string) { return this.sessionStorage.endSession(sessionId); }

  async getRecentSessionActivity(limit: number = 5, hoursBack: number = 24): Promise<SessionActivity[]> {
    return this.sessionStorage.getRecentSessionActivity(limit, hoursBack);
  }
  
  async getSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessionStorage.getSessionById(sessionId);
  }

  async createSession(sessionData: InsertSession): Promise<Session> {
    return this.sessionStorage.createSession(sessionData);
  }

  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    return this.sessionStorage.updateSession(sessionId, updates);
  }

  // Session quality and lifecycle methods (delegated)
  async getTranscriptCountBySession(sessionId: string): Promise<number> {
    return this.sessionStorage.getTranscriptCountBySession(sessionId);
  }

  async getSessionQualityStats(): Promise<{
    total: number;
    real: number; 
    dead: number;
    breakdown: Record<string, number>;
  }> {
    return this.sessionStorage.getSessionQualityStats();
  }

  // Analytics methods
  async getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }> {
    const translationsForSession: Translation[] = await drizzleDB.select() // Added .select()
      .from(translations)
      .where(eq(translations.sessionId, sessionId));

    if (translationsForSession.length === 0) {
        return { totalTranslations: 0, averageLatency: 0, languagePairs: [] };
    }

    const totalTranslationsCount = translationsForSession.length;
    const totalLatencySum = translationsForSession.reduce((sum: number, t: Translation) => sum + (t.latency || 0), 0);
    const averageLatencyValue = totalTranslationsCount > 0 ? totalLatencySum / totalTranslationsCount : 0;

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
    return { totalTranslations: totalTranslationsCount, averageLatency: averageLatencyValue, languagePairs: Array.from(languagePairsMap.values()) };
  }

  // Teacher ID session methods - delegate to sessionStorage
  async findActiveSessionByTeacherId(teacherId: string): Promise<Session | null> {
    await this.ensureInitialized();
    return this.sessionStorage.findActiveSessionByTeacherId(teacherId);
  }

  async findRecentSessionByTeacherId(teacherId: string, withinMinutes?: number): Promise<Session | null> {
    await this.ensureInitialized();
    return this.sessionStorage.findRecentSessionByTeacherId(teacherId, withinMinutes);
  }

  async reactivateSession(sessionId: string): Promise<Session | null> {
    await this.ensureInitialized();
    return this.sessionStorage.reactivateSession(sessionId);
  }

  async createTranslation(translationData: InsertTranslation): Promise<Translation> {
    return this.translationStorage.createTranslation(translationData);
  }

  // Analytics methods for metrics
  async getSessionMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalSessions: number;
    averageSessionDuration: number;
    activeSessions: number;
    sessionsLast24Hours: number;
  }> {
    logger.debug('DatabaseStorage.getSessionMetrics called', { timeRange });
    const totalSessionsQueryName = timeRange ? "total_sessions_query_with_time_range" : "total_sessions_query_without_time_range";
    
    const totalSessionsResult = await drizzleDB
      .select({ totalSessions: count() })
      .from(sessions)
      .where(timeRange ? and(gte(sessions.startTime, timeRange.startDate), lte(sessions.startTime, timeRange.endDate)) : undefined)
      .prepare(totalSessionsQueryName)
      .execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : undefined);
    const totalSessionsCount = Number(totalSessionsResult[0]?.totalSessions) || 0;
    
    let averageSessionDurationValue = 0;
    if (totalSessionsCount > 0) {
      const durationQueryName = timeRange ? "sum_duration_query_with_time_range" : "sum_duration_query_without_time_range";
      const durationResult = await drizzleDB
        .select({
          totalDuration: sql<string>`SUM(CASE WHEN ${sessions.endTime} IS NOT NULL THEN EXTRACT(EPOCH FROM (${sessions.endTime} - ${sessions.startTime})) * 1000 ELSE 0 END)::bigint`,
          countSessions: count(sessions.id),
        })
        .from(sessions)
        .where(timeRange ?
          and(gte(sessions.startTime, timeRange.startDate), lte(sessions.startTime, timeRange.endDate), isNotNull(sessions.endTime)) :
          isNotNull(sessions.endTime)
        )
        .prepare(durationQueryName)
        .execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : undefined);
      if (durationResult && durationResult.length > 0 && durationResult[0].countSessions && Number(durationResult[0].countSessions) > 0) {
        averageSessionDurationValue = (Number(durationResult[0].totalDuration) || 0) / (Number(durationResult[0].countSessions));
      }
    }
    
    const activeSessionsResult = await drizzleDB
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.isActive, true))
      .prepare("active_sessions_query")
      .execute();
    const activeSessionsCount = Number(activeSessionsResult[0]?.count) || 0;
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const sessionsLast24HoursResult = await drizzleDB
      .select({ count: count() })
      .from(sessions)
      .where(gte(sessions.startTime, twentyFourHoursAgo))
      .prepare("sessions_last_24_hours_query")
      .execute();
    const sessionsLast24HoursCount = Number(sessionsLast24HoursResult[0]?.count) || 0;
    
    logger.debug('DatabaseStorage.getSessionMetrics results', { totalSessionsCount, averageSessionDuration: averageSessionDurationValue, activeSessionsCount, sessionsLast24Hours: sessionsLast24HoursCount });
    return {
      totalSessions: totalSessionsCount,
      averageSessionDuration: averageSessionDurationValue,
      activeSessions: activeSessionsCount,
      sessionsLast24Hours: sessionsLast24HoursCount,
    };
  }
  
  async getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number;
  }> {
    logger.debug('DatabaseStorage.getTranslationMetrics called', { timeRange });
    const mainQueryName = timeRange ? "translation_metrics_main_with_range" : "translation_metrics_main_no_range";
    let query = drizzleDB
      .select({
        total_translations: count(translations.id),
        avg_latency: avg(translations.latency),
      })
      .from(translations);
    if (timeRange) {
      query = query.where(and(gte(translations.timestamp, timeRange.startDate), lte(translations.timestamp, timeRange.endDate))) as any;
    }
    const mainMetricsResult = await query.prepare(mainQueryName).execute(timeRange);
    let totalTranslationsValue = 0;
    let averageLatencyValue = 0;
    if (mainMetricsResult && mainMetricsResult.length > 0) {
      totalTranslationsValue = Number(mainMetricsResult[0].total_translations) || 0;
      averageLatencyValue = Math.round(Number(mainMetricsResult[0].avg_latency)) || 0;
    }
    const recentTranslationsQueryName = "translation_metrics_recent";
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentTranslationsResult = await drizzleDB
      .select({ count: count(translations.id) })
      .from(translations)
      .where(gte(translations.timestamp, oneHourAgo))
      .prepare(recentTranslationsQueryName)
      .execute();
    let recentTranslationsCount = 0;
    if (recentTranslationsResult && recentTranslationsResult.length > 0 && recentTranslationsResult[0].count !== null) {
      recentTranslationsCount = Number(recentTranslationsResult[0].count) || 0;
    }
    logger.debug('DatabaseStorage.getTranslationMetrics results', { totalTranslations: totalTranslationsValue, averageLatency: averageLatencyValue, recentTranslations: recentTranslationsCount });
    return { totalTranslations: totalTranslationsValue, averageLatency: averageLatencyValue, recentTranslations: recentTranslationsCount };
  }
  
  async getLanguagePairUsage(timeRange?: { startDate: Date; endDate: Date }): Promise<Array<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }>> {
    logger.debug('DatabaseStorage.getLanguagePairUsage called', { timeRange });
    const queryName = timeRange ? "language_pair_usage_query_with_range" : "language_pair_usage_query_no_range";
    let queryBuilder = drizzleDB
      .select({
        source_language: translations.sourceLanguage,
        target_language: translations.targetLanguage,
        pair_count: count(translations.id),
        avg_latency: avg(translations.latency),
      })
      .from(translations);
    if (timeRange) {
      queryBuilder = queryBuilder.where(and(gte(translations.timestamp, timeRange.startDate), lte(translations.timestamp, timeRange.endDate))) as any;
    }
    const finalQuery = queryBuilder
      .groupBy(translations.sourceLanguage, translations.targetLanguage)
      .orderBy(desc(count(translations.id)));
    const results = await finalQuery.prepare(queryName).execute(timeRange);
    if (!results || results.length === 0) {
      return [];
    }
    return results.map((row: any) => ({
      sourceLanguage: row.source_language ?? "unknown",
      targetLanguage: row.target_language ?? "unknown",
      count: Number(row.pair_count) || 0,
      averageLatency: Math.round(Number(row.avg_latency)) || 0,
    }));
  }

  // Note: Database reset functionality has been moved to test utilities
  // to avoid contaminating production code with test-specific methods
}
