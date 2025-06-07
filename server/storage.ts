/**
 * Storage Service
 * 
 * Provides an abstraction layer for data persistence with both
 * in-memory and database implementations.
 */

import {
  type User,
  type InsertUser,
  type Language,
  type InsertLanguage,
  type Translation,
  type InsertTranslation,
  type Transcript,
  type InsertTranscript,
  type Session,
  type InsertSession,
  users,
  languages,
  translations,
  transcripts,
  sessions
} from "../shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import { getStorageType } from "./config";

// Constants
const DEFAULT_QUERY_LIMIT = 10;
const DEFAULT_LANGUAGES: InsertLanguage[] = [
  { code: "en-US", name: "English (United States)", isActive: true },
  { code: "es", name: "Spanish", isActive: true },
  { code: "de", name: "German", isActive: true },
  { code: "fr", name: "French", isActive: true }
];

/**
 * Storage error class for better error handling
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DUPLICATE_ENTRY' | 'STORAGE_ERROR' | 'CREATE_FAILED',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Storage interface defining all data access methods
 */
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
  
  // Diagnostics methods
  getSessionMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
  }>;
  getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number;
  }>;
  getLanguagePairMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }[]>;
  getRecentSessionActivity(limit?: number): Promise<{
    sessionId: string;
    teacherLanguage: string | null;
    transcriptCount: number;
    startTime: Date;
    endTime: Date | null;
    duration: number;
  }[]>;
}

/**
 * In-memory storage implementation
 * Useful for testing and development without database dependencies
 */
export class MemStorage implements IStorage {
  private readonly users: Map<number, User>;
  private readonly languages: Map<number, Language>;
  private readonly translations: Map<number, Translation>;
  private readonly transcripts: Map<number, Transcript>;
  private readonly sessions: Map<number, Session>;
  
  // ID generators
  private userId: number;
  private languageId: number;
  private translationId: number;
  private transcriptId: number;
  private sessionId: number;

  constructor() {
    // Initialize collections
    this.users = new Map();
    this.languages = new Map();
    this.translations = new Map();
    this.transcripts = new Map();
    this.sessions = new Map();
    
    // Initialize ID counters
    this.userId = 1;
    this.languageId = 1;
    this.translationId = 1;
    this.transcriptId = 1;
    this.sessionId = 1;
    
    // Initialize with default languages
    this.initializeDefaultLanguages();
  }

  /**
   * Initialize storage with default languages
   */
  private initializeDefaultLanguages(): void {
    DEFAULT_LANGUAGES.forEach(lang => {
      this.createLanguage(lang).catch(error => {
        console.error(`Failed to initialize language ${lang.code}:`, error);
      });
    });
  }

  /**
   * Validates user input
   */
  private validateUser(user: InsertUser): void {
    if (!user.username || user.username.trim().length === 0) {
      throw new StorageError('Username is required', 'VALIDATION_ERROR');
    }
    if (!user.password || user.password.length < 6) {
      throw new StorageError('Password must be at least 6 characters', 'VALIDATION_ERROR');
    }
  }

  /**
   * Validates language input
   */
  private validateLanguage(language: InsertLanguage): void {
    if (!language.code || language.code.trim().length === 0) {
      throw new StorageError('Language code is required', 'VALIDATION_ERROR');
    }
    if (!language.name || language.name.trim().length === 0) {
      throw new StorageError('Language name is required', 'VALIDATION_ERROR');
    }
  }

  /**
   * Validates translation input
   */
  private validateTranslation(translation: InsertTranslation): void {
    if (!translation.sourceLanguage || !translation.targetLanguage) {
      throw new StorageError('Source and target languages are required', 'VALIDATION_ERROR');
    }
    if (!translation.originalText || !translation.translatedText) {
      throw new StorageError('Original and translated text are required', 'VALIDATION_ERROR');
    }
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
    this.validateUser(insertUser);
    
    // Check for duplicate username
    const existing = await this.getUserByUsername(insertUser.username);
    if (existing) {
      throw new StorageError(
        `User with username '${insertUser.username}' already exists`,
        'DUPLICATE_ENTRY'
      );
    }
    
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
    this.validateLanguage(insertLanguage);
    
    // Check for duplicate code
    const existing = await this.getLanguageByCode(insertLanguage.code);
    if (existing) {
      throw new StorageError(
        `Language with code '${insertLanguage.code}' already exists`,
        'DUPLICATE_ENTRY'
      );
    }
    
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
    if (!language) {
      return undefined;
    }
    
    const updatedLanguage: Language = { ...language, isActive };
    this.languages.set(language.id, updatedLanguage);
    return updatedLanguage;
  }
  
  // Translation methods
  async addTranslation(insertTranslation: InsertTranslation): Promise<Translation> {
    this.validateTranslation(insertTranslation);
    
    const id = this.translationId++;
    const timestamp = (insertTranslation.timestamp && insertTranslation.timestamp instanceof Date) 
                      ? insertTranslation.timestamp 
                      : new Date();
    
    const translation: Translation = { 
      ...insertTranslation, 
      id, 
      timestamp,
      latency: insertTranslation.latency ?? null
    };
    this.translations.set(id, translation);
    return translation;
  }
  
  async getTranslationsByLanguage(targetLanguage: string, limit = DEFAULT_QUERY_LIMIT): Promise<Translation[]> {
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
    if (!insertTranscript.sessionId || !insertTranscript.language || !insertTranscript.text) {
      throw new StorageError(
        'Session ID, language, and text are required for transcript',
        'VALIDATION_ERROR'
      );
    }
    
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
        if (!a.timestamp) return -1;
        if (!b.timestamp) return 1;
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
  }
  
  // Session methods
  async createSession(insertSession: InsertSession): Promise<Session> {
    if (!insertSession.sessionId) {
      throw new StorageError('Session ID is required', 'VALIDATION_ERROR');
    }
    
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
    if (!session) {
      return undefined;
    }
    
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
    if (!session) {
      return undefined;
    }
    
    const updatedSession: Session = { 
      ...session, 
      endTime: new Date(), 
      isActive: false 
    };
    this.sessions.set(session.id, updatedSession);
    return updatedSession;
  }

  // Analytics methods
  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    if (startDate > endDate) {
      throw new StorageError('Start date must be before end date', 'VALIDATION_ERROR');
    }
    
    return Array.from(this.translations.values()).filter(t => 
      t.timestamp && t.timestamp >= startDate && t.timestamp <= endDate
    );
  }

  async getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }> {
    // TODO: [Technical Debt - Feature Implementation]
    // Implement full analytics calculation for MemStorage. 
    // Current implementation is a placeholder and uses mock/zeroed data.
    
    const sessionTranscripts = Array.from(this.transcripts.values())
      .filter(t => t.sessionId === sessionId);
    
    // For now, return placeholder data
    return {
      totalTranslations: 0, 
      averageLatency: 0, 
      languagePairs: [] 
    };
  }

  /**
   * Get session metrics for diagnostics
   */
  async getSessionMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
  }> {
    // In-memory implementation
    let allSessions = Array.from(this.sessions.values());
    
    // Apply time range filter if provided
    if (timeRange) {
      allSessions = allSessions.filter(s => {
        const sessionStart = new Date(s.startTime).getTime();
        const sessionEnd = s.endTime ? new Date(s.endTime).getTime() : Date.now();
        const rangeStart = timeRange.startDate.getTime();
        const rangeEnd = timeRange.endDate.getTime();
        
        // Session overlaps with time range if it started before range end and ended after range start
        return sessionStart <= rangeEnd && sessionEnd >= rangeStart;
      });
    }
    
    const activeSessions = allSessions.filter(s => s.isActive);
    
    const durations = allSessions
      .filter(s => s.endTime)
      .map(s => new Date(s.endTime!).getTime() - new Date(s.startTime).getTime());
    
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      averageSessionDuration: averageDuration
    };
  }

  /**
   * Get translation metrics for diagnostics
   */
  async getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number;
  }> {
    // In-memory implementation
    let allTranslations = Array.from(this.translations.values());
    
    // Apply time range filter if provided
    if (timeRange) {
      allTranslations = allTranslations.filter(t => {
        if (!t.timestamp) return false;
        const translationTime = new Date(t.timestamp).getTime();
        return translationTime >= timeRange.startDate.getTime() && 
               translationTime <= timeRange.endDate.getTime();
      });
    }
    
    const oneHourAgo = Date.now() - 3600000;
    
    // Count recent translations within the filtered set
    const recentTranslations = allTranslations.filter(t => {
      if (!t.timestamp) return false;
      return new Date(t.timestamp).getTime() >= oneHourAgo;
    }).length;
    
    const avgLatency = allTranslations.length > 0
      ? allTranslations.reduce((sum, t) => sum + (t.latency || 0), 0) / allTranslations.length
      : 0;
    
    return {
      totalTranslations: allTranslations.length,
      averageLatency: avgLatency,
      recentTranslations: recentTranslations
    };
  }

  /**
   * Get language pair metrics for diagnostics
   */
  async getLanguagePairMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }[]> {
    // In-memory implementation
    let translationsToAnalyze = Array.from(this.translations.values());
    
    // Apply time range filter if provided
    if (timeRange) {
      translationsToAnalyze = translationsToAnalyze.filter(t => {
        if (!t.timestamp) return false;
        const translationTime = new Date(t.timestamp).getTime();
        return translationTime >= timeRange.startDate.getTime() && 
               translationTime <= timeRange.endDate.getTime();
      });
    }
    
    const pairMap = new Map<string, { count: number; totalLatency: number }>();
    
    for (const translation of translationsToAnalyze) {
      const key = `${translation.sourceLanguage}-${translation.targetLanguage}`;
      const existing = pairMap.get(key) || { count: 0, totalLatency: 0 };
      pairMap.set(key, {
        count: existing.count + 1,
        totalLatency: existing.totalLatency + (translation.latency || 0)
      });
    }
    
    return Array.from(pairMap.entries())
      .map(([key, data]) => {
        const [sourceLanguage, targetLanguage] = key.split('-');
        return {
          sourceLanguage,
          targetLanguage,
          count: data.count,
          averageLatency: data.totalLatency / data.count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get recent session activity for diagnostics
   */
  async getRecentSessionActivity(limit: number = 5) {
    // In-memory implementation
    const recentSessions = Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
    
    return recentSessions.map(s => {
      const transcriptCount = Array.from(this.transcripts.values())
        .filter(t => t.sessionId === s.sessionId).length;
      
      return {
        sessionId: s.sessionId,
        teacherLanguage: s.teacherLanguage,
        transcriptCount,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.endTime 
          ? new Date(s.endTime).getTime() - new Date(s.startTime).getTime()
          : 0
      };
    });
  }
}

/**
 * Database Storage Implementation
 * 
 * Implements the IStorage interface using PostgreSQL database
 */
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(user)
      .returning();
    
    if (!result[0]) {
      throw new StorageError('Failed to create user', 'CREATE_FAILED');
    }
    return result[0];
  }

  async getLanguages(): Promise<Language[]> {
    return await db.select().from(languages);
  }

  async getActiveLanguages(): Promise<Language[]> {
    return await db
      .select()
      .from(languages)
      .where(eq(languages.isActive, true));
  }

  async getLanguageByCode(code: string): Promise<Language | undefined> {
    const result = await db
      .select()
      .from(languages)
      .where(eq(languages.code, code))
      .limit(1);
    return result[0];
  }

  async createLanguage(language: InsertLanguage): Promise<Language> {
    const result = await db
      .insert(languages)
      .values(language)
      .returning();
    
    if (!result[0]) {
      throw new StorageError('Failed to create language', 'CREATE_FAILED');
    }
    return result[0];
  }

  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const result = await db
      .update(languages)
      .set({ isActive })
      .where(eq(languages.code, code))
      .returning();
    return result[0];
  }

  async addTranslation(translation: InsertTranslation): Promise<Translation> {
    const result = await db
      .insert(translations)
      .values({
        ...translation,
        timestamp: new Date()
      })
      .returning();
    
    if (!result[0]) {
      throw new StorageError('Failed to add translation', 'CREATE_FAILED');
    }
    return result[0];
  }

  async getTranslationsByLanguage(targetLanguage: string, limit: number = DEFAULT_QUERY_LIMIT): Promise<Translation[]> {
    return await db
      .select()
      .from(translations)
      .where(eq(translations.targetLanguage, targetLanguage))
      .orderBy(translations.timestamp)
      .limit(limit);
  }

  async addTranscript(transcript: InsertTranscript): Promise<Transcript> {
    const result = await db
      .insert(transcripts)
      .values({
        ...transcript,
        timestamp: new Date()
      })
      .returning();
    
    if (!result[0]) {
      throw new StorageError('Failed to add transcript', 'CREATE_FAILED');
    }
    return result[0];
  }

  async getTranscriptsBySession(sessionId: string, language: string, limit: number = DEFAULT_QUERY_LIMIT): Promise<Transcript[]> {
    return await db
      .select()
      .from(transcripts)
      .where(and(
        eq(transcripts.sessionId, sessionId),
        eq(transcripts.language, language)
      ))
      .orderBy(transcripts.timestamp)
      .limit(limit);
  }

  async getTranslations(limit: number = DEFAULT_QUERY_LIMIT): Promise<Translation[]> {
    return await db
      .select()
      .from(translations)
      .orderBy(translations.timestamp)
      .limit(limit);
  }

  async createSession(session: InsertSession): Promise<Session> {
    const result = await db
      .insert(sessions)
      .values({
        ...session,
        startTime: new Date(),
        endTime: null,
        isActive: true
      })
      .returning();
    
    if (!result[0]) {
      throw new StorageError('Failed to create session', 'CREATE_FAILED');
    }
    return result[0];
  }

  async getActiveSession(sessionId: string): Promise<Session | undefined> {
    const result = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.sessionId, sessionId),
        eq(sessions.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async getAllActiveSessions(): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(eq(sessions.isActive, true));
  }

  async endSession(sessionId: string): Promise<Session | undefined> {
    const result = await db
      .update(sessions)
      .set({ 
        endTime: new Date(), 
        isActive: false 
      })
      .where(and(
        eq(sessions.sessionId, sessionId),
        eq(sessions.isActive, true)
      ))
      .returning();
    return result[0];
  }

  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const result = await db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.sessionId, sessionId))
      .returning();
    return result[0];
  }

  async getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]> {
    return await db
      .select()
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
    // TODO: [Technical Debt - Feature Implementation]
    // Implement full analytics calculation for DatabaseStorage. 
    // Current implementation is a placeholder and uses mock/zeroed data.
    
    const sessionTranscripts = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.sessionId, sessionId));
    
    // For now, return placeholder data
    return {
      totalTranslations: 0, 
      averageLatency: 0, 
      languagePairs: [] 
    };
  }

  /**
   * Get session metrics for diagnostics
   */
  async getSessionMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
  }> {
    const allSessions = await db.select().from(sessions);
    const activeSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.isActive, true));
    
    const durations = allSessions
      .filter(s => s.endTime)
      .map(s => new Date(s.endTime!).getTime() - new Date(s.startTime).getTime());
    
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      averageSessionDuration: averageDuration
    };
  }

  /**
   * Get translation metrics for diagnostics
   */
  async getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number;
  }> {
    const allTranslations = await db.select().from(translations);
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const recentTranslations = await db
      .select()
      .from(translations)
      .where(gte(translations.timestamp, oneHourAgo));
    
    const avgLatency = allTranslations.length > 0
      ? allTranslations.reduce((sum, t) => sum + (t.latency || 0), 0) / allTranslations.length
      : 0;
    
    return {
      totalTranslations: allTranslations.length,
      averageLatency: avgLatency,
      recentTranslations: recentTranslations.length
    };
  }

  /**
   * Get language pair metrics for diagnostics
   */
  async getLanguagePairMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }[]> {
    const allTranslations = await db.select().from(translations);
    const pairMap = new Map<string, { count: number; totalLatency: number }>();
    
    for (const translation of allTranslations) {
      const key = `${translation.sourceLanguage}-${translation.targetLanguage}`;
      const existing = pairMap.get(key) || { count: 0, totalLatency: 0 };
      pairMap.set(key, {
        count: existing.count + 1,
        totalLatency: existing.totalLatency + (translation.latency || 0)
      });
    }
    
    return Array.from(pairMap.entries())
      .map(([key, data]) => {
        const [sourceLanguage, targetLanguage] = key.split('-');
        return {
          sourceLanguage,
          targetLanguage,
          count: data.count,
          averageLatency: data.totalLatency / data.count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get recent session activity for diagnostics
   */
  async getRecentSessionActivity(limit: number = 5) {
    const recentSessions = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.startTime))
      .limit(limit);
    
    const results = [];
    for (const session of recentSessions) {
      const transcriptCount = await db
        .select({ count: count() })
        .from(transcripts)
        .where(eq(transcripts.sessionId, session.sessionId));
      
      results.push({
        sessionId: session.sessionId,
        teacherLanguage: session.teacherLanguage,
        transcriptCount: transcriptCount[0]?.count || 0,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.endTime 
          ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
          : 0
      });
    }
    
    return results;
  }
}

// Export storage instance - use configuration to determine which storage to use
export const storage = (() => {
  const storageType = getStorageType();
  
  if (storageType === 'database') {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set when storage type is database');
    }
    console.log('[Storage] Using DatabaseStorage');
    return new DatabaseStorage();
  } else {
    console.log('[Storage] Using MemStorage');
    return new MemStorage();
  }
})();
