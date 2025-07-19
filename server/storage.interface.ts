import {
  type User, type InsertUser,
  type Language, type InsertLanguage,
  type Translation, type InsertTranslation,
  type Transcript, type InsertTranscript,
  type Session, type InsertSession,
} from '../shared/schema';

export interface StorageTranslationMetrics {
  totalTranslations: number;
  averageLatency: number;
  recentTranslations: number; // This field's definition (e.g., count in last X time) should be clear in implementations
}

export interface StorageSessionMetrics {
  totalSessions: number;
  activeSessions: number; // Typically, count of sessions marked isActive:true in DB for the range
  averageSessionDuration: number;
  sessionsLast24Hours: number;
}

export interface StorageLanguagePairUsageData {
  sourceLanguage: string;
  targetLanguage: string;
  count: number;
  averageLatency: number;
}

export interface StorageRecentSessionActivity {
  sessionId: string;
  teacherLanguage: string | null;
  studentLanguage: string | null;
  classCode: string | null;
  transcriptCount: number;
  studentCount: number;
  startTime: Date | null;
  endTime: Date | null;
  duration: number; // Duration in milliseconds
}

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
  getCurrentlyActiveSessions(): Promise<Session[]>;
  endSession(sessionId: string): Promise<Session | undefined>;
  getRecentSessionActivity(limit?: number, hoursBack?: number): Promise<StorageRecentSessionActivity[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  getTranscriptCountBySession(sessionId: string): Promise<number>;
  getSessionQualityStats(): Promise<{
    total: number;
    real: number; 
    dead: number;
    breakdown: Record<string, number>;
  }>;
  
  // Teacher ID session methods
  findActiveSessionByTeacherId(teacherId: string): Promise<Session | null>;
  findRecentSessionByTeacherId(teacherId: string, withinMinutes?: number): Promise<Session | null>;
  reactivateSession(sessionId: string): Promise<Session | null>;
  
  // Analytics methods
  getSessionAnalytics(sessionId: string): Promise<{ // Consider defining a type for this return
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }>;
  
  // Additional analytics methods for metrics
  getSessionMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalSessions: number;
    averageSessionDuration: number;
    activeSessions: number;
    sessionsLast24Hours: number;
  }>;
  
  getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number;
  }>;
  
  getLanguagePairUsage(timeRange?: { startDate: Date; endDate: Date }): Promise<Array<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }>>;
}
