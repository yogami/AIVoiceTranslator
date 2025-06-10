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
import { MemUserStorage } from "./storage/user.storage";
import { MemLanguageStorage } from "./storage/language.storage";
import { MemTranslationStorage } from "./storage/translation.storage";
import { MemTranscriptStorage } from "./storage/transcript.storage";
import { MemSessionStorage } from "./storage/session.storage";

export class MemStorage implements IStorage {
  // User storage part
  private userStorage: MemUserStorage;
  // Language storage part
  private languageStorage: MemLanguageStorage;
  // Translation storage part
  private translationStorage: MemTranslationStorage;
  // Transcript storage part
  private transcriptStorage: MemTranscriptStorage;
  // Session storage part
  private sessionStorage: MemSessionStorage;

  // Shared data structures for MemStorage sub-modules to reference the same data
  private readonly usersMap: Map<number, User>;
  private readonly languagesMap: Map<number, Language>;
  private readonly translationsMap: Map<number, Translation>;
  private readonly transcriptsMap: Map<number, Transcript>;
  private readonly sessionsMap: Map<number, Session>;

  private userIdCounter: { value: number };
  private languageIdCounter: { value: number };
  private translationIdCounter: { value: number };
  private transcriptIdCounter: { value: number };
  private sessionIdCounter: { value: number };

  constructor() {
    this.usersMap = new Map();
    this.languagesMap = new Map();
    this.translationsMap = new Map();
    this.transcriptsMap = new Map();
    this.sessionsMap = new Map();

    // Initialize counters as objects for reference passing
    this.userIdCounter = { value: 1 };
    this.languageIdCounter = { value: 1 };
    this.translationIdCounter = { value: 1 };
    this.transcriptIdCounter = { value: 1 };
    this.sessionIdCounter = { value: 1 };

    this.userStorage = new MemUserStorage(this.usersMap, this.userIdCounter);
    this.languageStorage = new MemLanguageStorage(this.languagesMap, this.languageIdCounter);
    this.translationStorage = new MemTranslationStorage(this.translationsMap, this.translationIdCounter);
    this.transcriptStorage = new MemTranscriptStorage(this.transcriptsMap, this.transcriptIdCounter);
    this.sessionStorage = new MemSessionStorage(this.sessionsMap, this.sessionIdCounter, this.transcriptsMap);
    
    // Initialize default languages after creating the storage instances
    this.initializeDefaultLanguages().catch(console.error);
  }

  private async initializeDefaultLanguages(): Promise<void> {
    if (this.languageStorage.initializeDefaultLanguages) {
      await this.languageStorage.initializeDefaultLanguages();
    }
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
  async addTranslation(translation: InsertTranslation) { 
    return this.translationStorage.addTranslation(translation);
  }
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
    const relevantTranslations = Array.from(this.translationsMap.values())
        .filter(t => t.sessionId === sessionId);

    if (relevantTranslations.length === 0) {
        return { totalTranslations: 0, averageLatency: 0, languagePairs: [] };
    }

    const totalTranslations = relevantTranslations.length;
    const totalLatencySum = relevantTranslations.reduce((sum: number, t: Translation) => sum + (t.latency || 0), 0);
    const averageLatency = totalTranslations > 0 ? totalLatencySum / totalTranslations : 0;
    
    const languagePairsMap = new Map<string, { sourceLanguage: string; targetLanguage: string; count: number }>();
    for (const t of relevantTranslations) {
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
    sessionsLast24Hours: number;
  }> {
    let allSessionsView = Array.from(this.sessionsMap.values());
    if (timeRange) {
      allSessionsView = allSessionsView.filter((s: Session) => {
        if (!s.startTime) return false;
        const sessionStart = new Date(s.startTime).getTime();
        const sessionEnd = s.endTime ? new Date(s.endTime).getTime() : Date.now();
        const rangeStart = timeRange.startDate.getTime();
        const rangeEnd = timeRange.endDate.getTime();
        return sessionStart <= rangeEnd && sessionEnd >= rangeStart;
      });
    }
    const activeSessionsCount = allSessionsView.filter((s: Session) => s.isActive).length;
    const durations = allSessionsView
      .filter((s: Session) => s.startTime && s.endTime)
      .map((s: Session) => new Date(s.endTime!).getTime() - new Date(s.startTime!).getTime());
    const averageDuration = durations.length > 0 ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length : 0;
    // Calculate sessions in last 24 hours
    const now = Date.now();
    const sessionsLast24Hours = Array.from(this.sessionsMap.values()).filter((s: Session) => {
      if (!s.startTime) return false;
      const sessionStart = new Date(s.startTime).getTime();
      return sessionStart >= now - 24 * 60 * 60 * 1000;
    }).length;
    return {
      totalSessions: allSessionsView.length,
      activeSessions: activeSessionsCount,
      averageSessionDuration: averageDuration,
      sessionsLast24Hours
    };
  }

  async getTranslationMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{ 
    totalTranslations: number; 
    averageLatency: number; 
    recentTranslations: number;
  }> {
    let translationsArray = Array.from(this.translationsMap.values());
    
    // Apply time range filter if provided
    if (timeRange) {
      translationsArray = translationsArray.filter(t => {
        if (!t.timestamp) return false;
        const translationTime = new Date(t.timestamp).getTime();
        return translationTime >= timeRange.startDate.getTime() && 
               translationTime <= timeRange.endDate.getTime();
      });
    }
    
    const totalTranslations = translationsArray.length;
    
    const averageLatency = totalTranslations > 0
      ? translationsArray.reduce((sum, t) => sum + (t.latency || 0), 0) / totalTranslations
      : 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTranslations = translationsArray.filter(t => {
      if (!t.timestamp) return false;
      const translationTime = new Date(t.timestamp).getTime();
      return translationTime > oneDayAgo.getTime();
    }).length;

    return { totalTranslations, averageLatency, recentTranslations };
  }

  async getLanguagePairMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<{
    sourceLanguage: string;
    targetLanguage: string;
    count: number;
    averageLatency: number;
  }[]> {
    let translationsToAnalyze = Array.from(this.translationsMap.values());
    if (timeRange) {
      translationsToAnalyze = translationsToAnalyze.filter((t: Translation) => {
        if (!t.timestamp) return false;
        const translationTime = new Date(t.timestamp).getTime();
        return translationTime >= timeRange.startDate.getTime() && translationTime <= timeRange.endDate.getTime();
      });
    }
    const pairMap = new Map<string, { count: number; totalLatency: number; sourceLanguage: string; targetLanguage: string }>();
    for (const translation of translationsToAnalyze) {
        if (translation.sourceLanguage && translation.targetLanguage) {
            const key = `${translation.sourceLanguage}-${translation.targetLanguage}`;
            const existing = pairMap.get(key) || { count: 0, totalLatency: 0, sourceLanguage: translation.sourceLanguage, targetLanguage: translation.targetLanguage };
            pairMap.set(key, { ...existing, count: existing.count + 1, totalLatency: existing.totalLatency + (translation.latency || 0) });
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