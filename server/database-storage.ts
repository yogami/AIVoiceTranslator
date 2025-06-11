import {
  type User, users, type InsertUser,
  type Session, sessions, type InsertSession,
  type Translation, translations, type InsertTranslation,
  type Language, type InsertLanguage,
  type Transcript, type InsertTranscript,
  languages // Assuming languages might be needed, if not, this can be removed too.
} from '../shared/schema'; // Correct: ../shared/schema
import { StorageError, StorageErrorCode } from './storage.error'; // Corrected path
import { IStorage } from './storage.interface'; // Corrected IStorage import path
import logger from './logger'; // Corrected: import default export
import { avg, count, desc, eq, gte, lte, and, sql, isNotNull, placeholder } from 'drizzle-orm';
import { db as drizzleDB } from './db'; // Corrected path, using drizzleDB alias

// Import sub-storage classes
import { DbUserStorage } from './storage/user.storage';
import { DbLanguageStorage } from './storage/language.storage';
import { DbTranslationStorage } from './storage/translation.storage';
import { DbTranscriptStorage } from './storage/transcript.storage';
import { DbSessionStorage } from './storage/session.storage';

// const logger = WinstonLogger.getInstance(); // REMOVED - logger is imported directly

export class DatabaseStorage implements IStorage {
  private userStorage: DbUserStorage;
  private languageStorage: DbLanguageStorage;
  private translationStorage: DbTranslationStorage;
  private transcriptStorage: DbTranscriptStorage;
  private sessionStorage: DbSessionStorage;
  // Removed private db member, will use drizzleDB directly

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
  async listUsers(): Promise<User[]> { // Ensure listUsers is implemented from IStorage
    return this.userStorage.listUsers();
  }


  // Language methods (delegated)
  async getLanguage(id: number): Promise<Language | undefined> { // Ensure getLanguage is implemented
    return this.languageStorage.getLanguage(id);
  }
  async getLanguages() { return this.languageStorage.getLanguages(); }
  async getActiveLanguages() { return this.languageStorage.getActiveLanguages(); }
  async getLanguageByCode(code: string) { return this.languageStorage.getLanguageByCode(code); }
  async createLanguage(language: InsertLanguage) { return this.languageStorage.createLanguage(language); }
  async updateLanguageStatus(code: string, isActive: boolean) { return this.languageStorage.updateLanguageStatus(code, isActive); }
  async listLanguages(): Promise<Language[]> { // Ensure listLanguages is implemented
    return this.languageStorage.listLanguages();
  }
  async initializeDefaultLanguages(): Promise<void> {
    if (this.languageStorage.initializeDefaultLanguages) {
      await this.languageStorage.initializeDefaultLanguages();
    } else {
      logger.warn('initializeDefaultLanguages not implemented on the current language sub-storage');
    }
  }

  // Translation methods (delegated for some, specific for metrics)
  async getTranslation(id: number): Promise<Translation | undefined> { // Ensure getTranslation is implemented
    return this.translationStorage.getTranslation(id);
  }
  async createTranslation(translation: InsertTranslation): Promise<Translation> { // Ensure createTranslation is implemented
    return this.translationStorage.createTranslation(translation);
  }
  async addTranslation(translation: InsertTranslation) { return this.translationStorage.addTranslation(translation); }
  async getTranslationsByLanguage(targetLanguage: string, limit?: number) { return this.translationStorage.getTranslationsByLanguage(targetLanguage, limit); }
  async getTranslations(limit?: number, offset?: number): Promise<Translation[]> { // Added offset to match IStorage if necessary
     return this.translationStorage.getTranslations(limit, offset);
  }
  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    return this.translationStorage.getTranslationsByDateRange(startDate, endDate);
  }


  // Transcript methods (delegated)
  async addTranscript(transcript: InsertTranscript) { return this.transcriptStorage.addTranscript(transcript); }
  async getTranscriptsBySession(sessionId: string, language: string, limit?: number) { return this.transcriptStorage.getTranscriptsBySession(sessionId, language, limit); }


  // Session methods (delegated for some, specific for metrics)
  async createSession(session: InsertSession) { return this.sessionStorage.createSession(session); }
  async updateSession(sessionId: string, updates: Partial<InsertSession>) { return this.sessionStorage.updateSession(sessionId, updates); }
  async getActiveSession(sessionId: string) { return this.sessionStorage.getActiveSession(sessionId); }
  async getAllActiveSessions() { return this.sessionStorage.getAllActiveSessions(); }
  async endSession(sessionId: string) { return this.sessionStorage.endSession(sessionId); }
  
  // Make sure the return type matches IStorage or the specific implementation in DbSessionStorage
  async getRecentSessionActivity(limit: number = 5): Promise<Array<{
    sessionId: string; // Changed from id to sessionId to match DbSessionStorage
    teacherLanguage: string | null; // Added to match DbSessionStorage
    transcriptCount: number; // Added to match DbSessionStorage
    startTime: Date | null; // Changed from Date to Date | null
    endTime: Date | null;   // Changed from Date to Date | null
    duration: number; // Added to match DbSessionStorage
  }>> {
    return this.sessionStorage.getRecentSessionActivity(limit);
  }

  // Analytics methods
  async getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }> {
    const translationsForSession: Translation[] = await drizzleDB.select() // Use drizzleDB
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
    averageSessionDuration: number; // Renamed from averageDuration
    activeSessions: number;
  }> {
    logger.debug('DatabaseStorage.getSessionMetrics called', { timeRange });

    const conditions = [];
    if (timeRange) {
      conditions.push(gte(sessions.startTime, placeholder('startDate')));
      conditions.push(lte(sessions.startTime, placeholder('endDate'))); // Corrected to use placeholder for endDate as well
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalSessionsQuery = drizzleDB // Use drizzleDB
      .select({
        totalSessions: count(sessions.id),
      })
      .from(sessions);

    if (whereClause) {
      totalSessionsQuery.where(whereClause);
    }
    
    const totalSessionsResult = await totalSessionsQuery.prepare("total_sessions_query").execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : {});
    const totalSessionsCount = Number(totalSessionsResult[0]?.totalSessions) || 0;

    let averageSessionDurationValue = 0; // Renamed variable
    if (totalSessionsCount > 0) {
      const validEndedSessionConditions = [];
      validEndedSessionConditions.push(isNotNull(sessions.endTime));
      validEndedSessionConditions.push(isNotNull(sessions.startTime));

      if (timeRange) {
        validEndedSessionConditions.push(gte(sessions.startTime, placeholder('startDate')));
        validEndedSessionConditions.push(lte(sessions.startTime, placeholder('endDate')));
      }

      const sumDurationQuery = drizzleDB // Use drizzleDB
        .select({
          totalDuration: sql<number>`SUM(EXTRACT(EPOCH FROM (${sessions.endTime} - ${sessions.startTime})))`.mapWith(Number),
          countSessions: count(sessions.id)
        })
        .from(sessions)
        .where(and(...validEndedSessionConditions));
      
      const durationResult = await sumDurationQuery.prepare("sum_duration_query").execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : {});

      if (durationResult[0] && durationResult[0].totalDuration != null && durationResult[0].countSessions > 0) {
        averageSessionDurationValue = durationResult[0].totalDuration / durationResult[0].countSessions;
      }
    }

    const activeSessionsResult = await drizzleDB // Use drizzleDB
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.isActive, true))
      .prepare("active_sessions_query")
      .execute();
    const activeSessionsCount = Number(activeSessionsResult[0]?.count) || 0;

    logger.debug('DatabaseStorage.getSessionMetrics results', { totalSessionsCount, averageSessionDuration: averageSessionDurationValue, activeSessionsCount });
    return {
      totalSessions: totalSessionsCount,
      averageSessionDuration: averageSessionDurationValue, // Renamed field
      activeSessions: activeSessionsCount,
    };
  }

  async getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number; // Added back to match IStorage
  }> {
    logger.debug('DatabaseStorage.getTranslationMetrics called', { timeRange });

    const conditions = [];
    if (timeRange) {
      conditions.push(gte(translations.timestamp, placeholder('startDate')));
      conditions.push(lte(translations.timestamp, placeholder('endDate')));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = drizzleDB // Use drizzleDB
      .select({
        totalTranslations: count(translations.id),
        averageLatency: avg(translations.latency),
      })
      .from(translations);

    if (whereClause) {
      query.where(whereClause);
    }
    
    const result = await query.prepare("translation_metrics_query").execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : {});
    const metrics = result[0] || { totalTranslations: 0, averageLatency: null }; 

    // For recentTranslations, if a timeRange is provided, it's the count within that range.
    // If no timeRange, it's the total count, same as totalTranslations.
    // This interpretation aligns with how it was before, but now explicitly tied to the timeRange if present.
    const recentTranslationsCount = Number(metrics.totalTranslations) || 0;

    logger.debug('DatabaseStorage.getTranslationMetrics results', { metrics, recentTranslationsCount });
    return {
      totalTranslations: Number(metrics.totalTranslations) || 0,
      averageLatency: Number(metrics.averageLatency) || 0,
      recentTranslations: recentTranslationsCount, // Added back
    };
  }

  async getLanguagePairMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<Array<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number; // Added to match IStorage
  }>> {
    logger.debug('DatabaseStorage.getLanguagePairMetrics called', { timeRange });

    const conditions = [];
    if (timeRange) {
      conditions.push(gte(translations.timestamp, placeholder('startDate'))); // Corrected typo here
      conditions.push(lte(translations.timestamp, placeholder('endDate')));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // To calculate averageLatency per pair, we need to adjust the query.
    // Drizzle ORM might require a subquery or raw SQL for this if not directly supported.
    // For now, returning a placeholder for averageLatency.
    // This will likely need further refinement.

    const query = drizzleDB // Use drizzleDB
      .select({
        sourceLanguage: translations.sourceLanguage,
        targetLanguage: translations.targetLanguage,
        count: count(translations.id),
        averageLatency: avg(translations.latency) // Added avg latency
      })
      .from(translations);

    if (whereClause) {
      query.where(whereClause);
    }
    
    query
      .groupBy(translations.sourceLanguage, translations.targetLanguage)
      .orderBy(desc(count(translations.id)));

    const results = await query.prepare("language_pair_metrics_query").execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : {});
    logger.debug('DatabaseStorage.getLanguagePairMetrics results', { results });
    
    return results.map((r: { sourceLanguage: string | null; targetLanguage: string | null; count: number; averageLatency: string | null }) => ({
      sourceLanguage: r.sourceLanguage || 'unknown',
      targetLanguage: r.targetLanguage || 'unknown',
      count: Number(r.count) || 0,
      averageLatency: Number(r.averageLatency) || 0, // Added, ensure type conversion is correct
    }));
  }
}
