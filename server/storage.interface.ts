import {
  type User, type InsertUser,
  type Language, type InsertLanguage,
  type Translation, type InsertTranslation,
  type Transcript, type InsertTranscript,
  type Session, type InsertSession,
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
  getTranslations(limit?: number): Promise<Translation[]>;
  getTranslationsByDateRange(startDate: Date, endDate: Date): Promise<Translation[]>;
  
  // Transcript methods
  addTranscript(transcript: InsertTranscript): Promise<Transcript>;
  getTranscriptsBySession(sessionId: string, language: string, limit?: number): Promise<Transcript[]>;
  
  // Session methods
  createSession(session: InsertSession): Promise<Session>;
  updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined>;
  getActiveSession(sessionId: string): Promise<Session | undefined>;
  getAllActiveSessions(): Promise<Session[]>;
  endSession(sessionId: string): Promise<Session | undefined>;
  getRecentSessionActivity(limit?: number): Promise<{
    sessionId: string;
    teacherLanguage: string | null;
    transcriptCount: number;
    startTime: Date | null;
    endTime: Date | null;
    duration: number;
  }[]>;
  
  // Analytics methods
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
}
