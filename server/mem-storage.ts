import {
  type Session,
  type Translation,
  type User,
  type Language,
  type Transcript,
  type InsertUser,
  type InsertLanguage,
  type InsertTranslation,
  type InsertTranscript,
  type InsertSession,
} from "../shared/schema";
import { 
  IStorage,
} from "./storage.interface"; // Updated IStorage import
import { StorageError } from "./storage.error";

export class MemStorage implements IStorage {
  private backend: IStorage;

  constructor(backend: IStorage) {
    this.backend = backend;
  }

  // User methods
  async getUser(id: number) { return this.backend.getUser(id); }
  async getUserByUsername(username: string) { return this.backend.getUserByUsername(username); }
  async createUser(user: InsertUser) { return this.backend.createUser(user); }

  // Language methods
  async getLanguages() { return this.backend.getLanguages(); }
  async getActiveLanguages() { return this.backend.getActiveLanguages(); }
  async getLanguageByCode(code: string) { return this.backend.getLanguageByCode(code); }
  async createLanguage(language: InsertLanguage) { return this.backend.createLanguage(language); }
  async updateLanguageStatus(code: string, isActive: boolean) { return this.backend.updateLanguageStatus(code, isActive); }

  // Translation methods
  async addTranslation(translation: InsertTranslation) { return this.backend.addTranslation(translation); }
  async getTranslationsByLanguage(targetLanguage: string, limit?: number) { return this.backend.getTranslationsByLanguage(targetLanguage, limit); }
  async getTranslations(limit?: number) { return this.backend.getTranslations(limit); }
  async getTranslationsByDateRange(startDate: Date, endDate: Date) { return this.backend.getTranslationsByDateRange(startDate, endDate); }

  // Transcript methods
  async addTranscript(transcript: InsertTranscript) { return this.backend.addTranscript(transcript); }
  async getTranscriptsBySession(sessionId: string, language: string, limit?: number) { return this.backend.getTranscriptsBySession(sessionId, language, limit); }

  // Session methods
  async createSession(session: InsertSession) { return this.backend.createSession(session); }
  async updateSession(sessionId: string, updates: Partial<InsertSession>) { return this.backend.updateSession(sessionId, updates); }
  async getActiveSession(sessionId: string) { return this.backend.getActiveSession(sessionId); }
  async getAllActiveSessions() { return this.backend.getAllActiveSessions(); }
  async endSession(sessionId: string) { return this.backend.endSession(sessionId); }
  async getRecentSessionActivity(limit?: number): Promise<{
    sessionId: string;
    teacherLanguage: string | null;
    transcriptCount: number;
    studentCount: number; // Added studentCount
    startTime: Date | null;
    endTime: Date | null;
    duration: number;
  }[]> {
    // Delegate to sessionStorage, which now needs to implement this with studentCount
    return this.backend.getRecentSessionActivity(limit);
  }
  async getSessionById(sessionId: string): Promise<Session | undefined> { return this.backend.getSessionById(sessionId); }

  // Analytics methods
  async getSessionAnalytics(sessionId: string): Promise<{
    totalTranslations: number;
    averageLatency: number;
    languagePairs: { sourceLanguage: string; targetLanguage: string; count: number }[];
  }> {
    return this.backend.getSessionAnalytics(sessionId);
  }

  // Diagnostics methods
  async getSessionMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
    sessionsLast24Hours: number;
  }> {
    return this.backend.getSessionMetrics(timeRange);
  }

  async getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    totalTranslations: number;
    averageLatency: number;
    recentTranslations: number;
  }> {
    return this.backend.getTranslationMetrics(timeRange);
  }

  async getLanguagePairUsage(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }[]> {
    return this.backend.getLanguagePairUsage(timeRange);
  }

  // Optionally, add a reset method if needed for tests
  async reset() { if (typeof (this.backend as any).reset === 'function') { await (this.backend as any).reset(); } }
}