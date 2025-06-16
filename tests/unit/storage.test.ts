// Ensure required env vars for strict config at the very top
process.env.PORT = process.env.PORT || '5001';
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/testdb';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';
process.env.VITE_API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:5001';
process.env.VITE_WS_URL = process.env.VITE_WS_URL || 'ws://127.0.0.1:5001';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TEST_DB_URL = process.env.TEST_DB_URL || 'postgres://user:pass@localhost:5432/testdb';

/**
 * Storage Tests (Consolidated)
 * 
 * A comprehensive test suite for the MemStorage implementation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemStorage } from '../../server/mem-storage';
import { DatabaseStorage } from '../../server/database-storage';
import { IStorage } from '../../server/storage.interface';
import * as schema from '../../shared/schema';
import { StorageError } from '../../server/storage.error';
import { db } from '../../server/db'; // Import to be mocked
import type { User, Language, Translation, Transcript, Session, InsertUser, InsertLanguage, InsertTranslation, InsertTranscript, InsertSession } from '../../shared/schema';

// Mock the db module for all DatabaseStorage unit tests
vi.mock('../../server/db', () => {
  // Create a chainable mock that always returns itself until the end
  const createChainableMock = (finalValue: any = []) => {
    const mockExecute = vi.fn().mockResolvedValue(finalValue);
    const mockPrepare = vi.fn(() => ({ execute: mockExecute }));

    const mock: any = vi.fn(() => mock);
    mock.from = vi.fn(() => mock);
    mock.where = vi.fn(() => mock);
    mock.limit = vi.fn(() => mock);
    mock.offset = vi.fn(() => mock);
    mock.orderBy = vi.fn(() => mock);
    mock.returning = vi.fn(() => mock);
    mock.values = vi.fn(() => mock);
    mock.set = vi.fn(() => mock);
    mock.$dynamic = vi.fn(() => mock);
    mock.prepare = mockPrepare; // Add prepare to the chain
    
    // Make it a thenable to resolve to the final value (for direct awaits on the chain)
    // This might not be strictly necessary if .execute() is always called
    mock.then = (resolve: any) => Promise.resolve(finalValue).then(resolve); 
    
    return mock;
  };

  const mockDbExecute = vi.fn();
  const mockDbPrepare = vi.fn((_queryName: string) => ({ execute: mockDbExecute }));


  return {
    db: {
      select: vi.fn(() => createChainableMock([])),
      insert: vi.fn(() => createChainableMock([])),
      update: vi.fn(() => createChainableMock([])),
      delete: vi.fn(() => createChainableMock({ rowCount: 1 })),
      prepare: mockDbPrepare, // Add top-level prepare mock
      // Mock Drizzle operators
      eq: vi.fn((column, value) => ({ type: 'operator', op: 'eq', column, value })),
      desc: vi.fn(column => ({ type: 'operator', op: 'desc', column })),
      and: vi.fn((...args) => ({ type: 'operator', op: 'and', args })),
      gte: vi.fn((column, value) => ({ type: 'operator', op: 'gte', column, value })),
      lte: vi.fn((column, value) => ({ type: 'operator', op: 'lte', column, value })),
    },
  };
});

// Minimal in-memory IStorage mock for unit tests
class InMemoryStorageMock implements IStorage {
  users: Map<string, User> = new Map();
  languages: Map<string, Language> = new Map([
    ['en-US', { id: 1, code: 'en-US', name: 'English (United States)', isActive: true }],
    ['es', { id: 2, code: 'es', name: 'Spanish', isActive: true }]
  ]);
  translations: Translation[] = [];
  transcripts: Transcript[] = [];
  sessions: Session[] = [];
  userId = 1;
  languageId = 3;
  translationId = 1;
  transcriptId = 1;
  sessionId = 1;

  async getLanguages(): Promise<Language[]> { return Array.from(this.languages.values()); }
  async getActiveLanguages(): Promise<Language[]> { return Array.from(this.languages.values()).filter(l => l.isActive); }
  async getLanguageByCode(code: string): Promise<Language | undefined> { return this.languages.get(code); }
  async createLanguage(lang: InsertLanguage): Promise<Language> {
    const newLang: Language = { ...lang, id: this.languageId++, isActive: lang.isActive ?? true };
    this.languages.set(lang.code, newLang);
    return newLang;
  }
  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const lang = this.languages.get(code);
    if (lang) { lang.isActive = isActive; this.languages.set(code, lang); return lang; }
    return undefined;
  }
  async getUser(id: number): Promise<User | undefined> { return Array.from(this.users.values()).find(u => u.id === id); }
  async getUserByUsername(username: string): Promise<User | undefined> { return this.users.get(username); }
  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = { ...user, id: this.userId++ };
    this.users.set(newUser.username, newUser);
    return newUser;
  }
  async addTranslation(t: InsertTranslation): Promise<Translation> {
    const newT: Translation = { ...t, id: this.translationId++, timestamp: t.timestamp ?? new Date() } as Translation;
    this.translations.push(newT);
    return newT;
  }
  async getTranslationsByLanguage(targetLanguage: string): Promise<Translation[]> { return this.translations.filter(t => t.targetLanguage === targetLanguage); }
  async getTranslations(): Promise<Translation[]> { return this.translations; }
  async getTranslationsByDateRange(): Promise<Translation[]> { return this.translations; }
  async addTranscript(tr: InsertTranscript): Promise<Transcript> {
    const newTr: Transcript = { ...tr, id: this.transcriptId++ } as Transcript;
    this.transcripts.push(newTr);
    return newTr;
  }
  async getTranscriptsBySession(sessionId: string): Promise<Transcript[]> { return this.transcripts.filter(t => t.sessionId === sessionId); }
  async createSession(s: InsertSession): Promise<Session> {
    const now = new Date();
    const newS: Session = { ...(s as any), id: this.sessionId++, studentsCount: (s as any).studentsCount ?? 0, isActive: s.isActive ?? true, startTime: (s as any).startTime ?? now, endTime: (s as any).endTime ?? null, totalTranslations: (s as any).totalTranslations ?? 0, averageLatency: (s as any).averageLatency ?? 0 };
    this.sessions.push(newS);
    return newS;
  }
  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const idx = this.sessions.findIndex(s => s.sessionId === sessionId);
    if (idx >= 0) { this.sessions[idx] = { ...this.sessions[idx], ...(updates as any) }; return this.sessions[idx]; }
    return undefined;
  }
  async endSession(sessionId: string): Promise<Session | undefined> {
    const idx = this.sessions.findIndex(s => s.sessionId === sessionId);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.sessions[idx], isActive: false, endTime: new Date() };
      return this.sessions[idx];
    }
    return undefined;
  }
  async getActiveSession(sessionId: string): Promise<Session | undefined> { return this.sessions.find(s => s.sessionId === sessionId && s.isActive); }
  async getAllActiveSessions(): Promise<Session[]> { return this.sessions.filter(s => s.isActive); }
  async getRecentSessionActivity(limit = 5): Promise<any[]> {
    // Sort by startTime descending
    const sorted = [...this.sessions].sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
      return bTime - aTime;
    });
    return sorted.slice(0, limit).map(s => ({
      sessionId: s.sessionId,
      teacherLanguage: s.teacherLanguage,
      transcriptCount: this.transcripts.filter(t => t.sessionId === s.sessionId).length,
      studentCount: (s as any).studentsCount ?? 0,
      startTime: s.startTime || null,
      endTime: s.endTime || null,
      duration: s.startTime && s.endTime ? (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) : 0
    }));
  }
  async getSessionById(sessionId: string): Promise<Session | undefined> { return this.sessions.find(s => s.sessionId === sessionId); }
  async getSessionAnalytics(): Promise<any> { return { totalTranslations: this.translations.length, averageLatency: 0, languagePairs: [] }; }
  async getSessionMetrics(): Promise<any> {
    const now = Date.now();
    const totalSessions = this.sessions.length;
    const activeSessions = this.sessions.filter(s => s.isActive).length;
    const durations = this.sessions.filter(s => s.startTime && s.endTime).map(s => new Date(s.endTime!).getTime() - new Date(s.startTime!).getTime());
    const averageSessionDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    const sessionsLast24Hours = this.sessions.filter(s => s.startTime && (new Date(s.startTime).getTime() >= now - 24 * 60 * 60 * 1000)).length;
    return { totalSessions, activeSessions, averageSessionDuration, sessionsLast24Hours };
  }
  async getTranslationMetrics(): Promise<any> {
    const now = Date.now();
    const totalTranslations = this.translations.length;
    const totalLatencySum = this.translations.reduce((sum, t) => sum + (t.latency || 0), 0);
    const averageLatency = totalTranslations > 0 ? totalLatencySum / totalTranslations : 0;
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentTranslations = this.translations.filter(t => {
      const timestamp = t.timestamp ? new Date(t.timestamp).getTime() : 0;
      return timestamp >= oneHourAgo;
    }).length;
    return { totalTranslations, averageLatency, recentTranslations };
  }
  async getLanguagePairUsage(): Promise<any[]> {
    const pairs = new Map<string, { sourceLanguage: string; targetLanguage: string; count: number; totalLatency: number }>();
    for (const t of this.translations) {
      if (t.sourceLanguage && t.targetLanguage) {
        const key = `${t.sourceLanguage}-${t.targetLanguage}`;
        if (!pairs.has(key)) {
          pairs.set(key, { sourceLanguage: t.sourceLanguage, targetLanguage: t.targetLanguage, count: 0, totalLatency: 0 });
        }
        const pair = pairs.get(key)!;
        pair.count++;
        pair.totalLatency += t.latency || 0;
      }
    }
    return Array.from(pairs.values()).map(pair => ({
      sourceLanguage: pair.sourceLanguage,
      targetLanguage: pair.targetLanguage,
      count: pair.count,
      averageLatency: pair.count > 0 ? pair.totalLatency / pair.count : 0
    }));
  }
}

describe('Storage Services', () => {
  describe('MemStorage', () => {
    let storage: IStorage;
    let mockBackend: IStorage;
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

    beforeEach(() => {
      mockBackend = new InMemoryStorageMock();
      storage = new MemStorage(mockBackend);
    });

    it('should initialize with default languages', async () => {
      // Act
      const result = await storage.getLanguages();
      
      // Assert
      expect(result.length).toBeGreaterThan(0);
      
      // Verify it contains expected languages
      const english = result.find((lang: schema.Language) => lang.code === 'en-US');
      const spanish = result.find((lang: schema.Language) => lang.code === 'es');
      
      expect(english).toBeDefined();
      expect(spanish).toBeDefined();
      
      if (english) expect(english.name).toBe('English (United States)');
      if (spanish) expect(spanish.name).toBe('Spanish');
    });

    it('should create and retrieve a user', async () => {
      // Arrange
      const testUser = {
        username: 'testuser',
        password: 'password123'
      };
      
      // Act
      const createdUser = await storage.createUser(testUser);
      const retrievedUser = await storage.getUserByUsername('testuser');
      
      // Assert
      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBeDefined();
      expect(createdUser.username).toBe(testUser.username);
      
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should update language status', async () => {
      // Arrange - Get a language to update
      const initialLanguages = await storage.getLanguages();
      const testCode = initialLanguages[0].code;
      
      // Act - Update the language status
      const updatedLanguage = await storage.updateLanguageStatus(testCode, false);
      const activeLanguages = await storage.getActiveLanguages();
      
      // Assert
      expect(updatedLanguage).toBeDefined();
      expect(updatedLanguage?.isActive).toBe(false);
      
      // The updated language should not be in active languages
      const foundInActive = activeLanguages.some((lang: schema.Language) => lang.code === testCode);
      expect(foundInActive).toBe(false);
    });

    it('should store and retrieve translations', async () => {
      // Arrange
      const testTranslation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 250
      };
      
      // Act
      const savedTranslation = await storage.addTranslation(testTranslation);
      const retrievedTranslations = await storage.getTranslationsByLanguage('es-ES', 10);
      
      // Assert
      expect(savedTranslation).toBeDefined();
      expect(savedTranslation.id).toBeDefined();
      expect(retrievedTranslations.length).toBeGreaterThan(0);
      
      const found = retrievedTranslations.find((t: schema.Translation) => t.id === savedTranslation.id);
      expect(found).toBeDefined();
      expect(found?.originalText).toBe('Hello world');
      expect(found?.translatedText).toBe('Hola mundo');
    });

    it('should store and retrieve transcripts by session', async () => {
      // Arrange
      const sessionId = 'test-session-1';
      const language = 'en-US';
      const testTranscript = {
        sessionId,
        language,
        text: 'This is a test transcript'
      };
      
      // Act
      const savedTranscript = await storage.addTranscript(testTranscript);
      const retrievedTranscripts = await storage.getTranscriptsBySession(sessionId, language);
      
      // Assert
      expect(savedTranscript).toBeDefined();
      expect(savedTranscript.id).toBeDefined();
      expect(retrievedTranscripts.length).toBe(1);
      expect(retrievedTranscripts[0].text).toBe('This is a test transcript');
    });

    it('should create and retrieve a language by code', async () => {
      const newLang: schema.InsertLanguage = { code: 'fr-FR', name: 'French (France)', isActive: true };
      const createdLang = await storage.createLanguage(newLang);
      expect(createdLang).toBeDefined();
      expect(createdLang.id).toBeDefined();
      expect(createdLang.code).toBe(newLang.code);
      expect(createdLang.name).toBe(newLang.name);
      expect(createdLang.isActive).toBe(true); // Default or specified

      const retrievedLang = await storage.getLanguageByCode('fr-FR');
      expect(retrievedLang).toEqual(createdLang);
    });

    it('should return undefined for a non-existent language code', async () => {
      const retrievedLang = await storage.getLanguageByCode('xx-XX');
      expect(retrievedLang).toBeUndefined();
    });

    it('should retrieve a user by ID', async () => {
      const newUser: schema.InsertUser = { username: 'userByIdTest', password: 'password' };
      const createdUser = await storage.createUser(newUser);
      expect(createdUser.id).toBeDefined();

      const retrievedUser = await storage.getUser(createdUser.id);
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return undefined for a non-existent user ID', async () => {
      const retrievedUser = await storage.getUser(99999);
      expect(retrievedUser).toBeUndefined();
    });

    describe('getSessionMetrics', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
      });

      it('should return zero metrics when no sessions exist', async () => {
        const metrics = await storage.getSessionMetrics();
        expect(metrics).toEqual({
          totalSessions: 0,
          activeSessions: 0,
          averageSessionDuration: 0,
          sessionsLast24Hours: 0,
        });
      });

      it('should correctly calculate metrics for active and completed sessions', async () => {
        // vi.useFakeTimers(); // Already set in beforeEach
        const thirtyMinutes = 30 * 60 * 1000;
        const nowTime = Date.now();
        const oneHour = 3600 * 1000;
        // Create session1: will be 1 hour old, active for 30 mins
        vi.setSystemTime(new Date(nowTime - oneHour));
        await storage.createSession({ sessionId: 's1', teacherLanguage: 'en-US' });
        vi.setSystemTime(new Date(nowTime - thirtyMinutes)); // s1 ended 30 mins ago, duration 30 mins
        await storage.endSession('s1');
        // Create session2: will be 10 mins old, active
        vi.setSystemTime(new Date(nowTime - tenMinutes));
        await storage.createSession({ sessionId: 's2', teacherLanguage: 'es-ES' });
        vi.setSystemTime(new Date(nowTime)); // Reset time to "current" for the metrics call
        const metrics = await storage.getSessionMetrics();
        expect(metrics.totalSessions).toBe(2);
        expect(metrics.activeSessions).toBe(1); // s2 is active
        expect(metrics.averageSessionDuration).toBeCloseTo(thirtyMinutes); // Only s1 has a duration
        // Both s1 (started 1h ago) and s2 (started 10m ago) are within the last 24 hours
        expect(metrics.sessionsLast24Hours).toBe(2); 
      });

      it('should ignore timeRange and calculate metrics for all sessions', async () => {
        // vi.useFakeTimers(); // Already set in beforeEach
        const nowTime = Date.now();
        const oneHour = 3600 * 1000;
        const twoHours = 2 * oneHour;
        const thirtyMinutes = 30 * 60 * 1000;

        // sTime1: created 2 hours ago, ended 1.5 hours ago (duration 30 mins)
        vi.setSystemTime(new Date(nowTime - twoHours));
        await storage.createSession({ sessionId: 'sTime1', teacherLanguage: 'en-US' });
        vi.setSystemTime(new Date(nowTime - oneHour - thirtyMinutes)); // ended 1.5h ago
        await storage.endSession('sTime1');

        // sTime2: created 30 mins ago, still active
        vi.setSystemTime(new Date(nowTime - thirtyMinutes));
        await storage.createSession({ sessionId: 'sTime2', teacherLanguage: 'fr-FR' });
        
        vi.setSystemTime(new Date(nowTime));

        const timeRange = { // This timeRange should be ignored by MemStorage
          startDate: new Date(nowTime - oneHour),
          endDate: new Date(nowTime),
        };
        const metrics = await storage.getSessionMetrics(timeRange);
        
        expect(metrics.totalSessions).toBe(2); // sTime1 and sTime2
        expect(metrics.activeSessions).toBe(1); // sTime2 is active
        // sTime1 duration is 30 mins, sTime2 is active (duration 0 for avg calc)
        expect(metrics.averageSessionDuration).toBeCloseTo(thirtyMinutes); 
        // Both sTime1 (started 2h ago) and sTime2 (started 30m ago) are within the last 24 hours
        expect(metrics.sessionsLast24Hours).toBe(2);
      });
    });

    describe('getTranslationMetrics', () => {
      it('should return zero metrics when no translations exist', async () => {
        const metrics = await storage.getTranslationMetrics();
        expect(metrics).toEqual({
          totalTranslations: 0,
          averageLatency: 0,
          recentTranslations: 0, // (e.g., last hour)
        });
      });

      it('should correctly calculate translation metrics', async () => {
        // const storage = new MemStorage(); // storage is already initialized in beforeEach
        vi.useFakeTimers();
        
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const thirtyMinutesAgo = now - 30 * 60 * 1000;
        const twoHoursAgo = now - 2 * 60 * 60 * 1000;
        const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

        vi.setSystemTime(now); // Set current time for consistent "recent" calculation
        
        // t1: Recent (30 minutes ago)
        await storage.addTranslation({
          sessionId: 'session1',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          originalText: 'Hello',
          translatedText: 'Hola',
          timestamp: new Date(thirtyMinutesAgo), // Explicitly 30 mins ago
          latency: 100
        });
        
        // t2: Recent (exactly 1 hour ago - should be included as recent)
        await storage.addTranslation({
          sessionId: 'session1',
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          originalText: 'World',
          translatedText: 'Monde',
          timestamp: new Date(oneHourAgo), // Explicitly 1 hour ago
          latency: 200
        });
        
        // t3: Old (2 hours ago) - should NOT be in recentTranslations
        await storage.addTranslation({
          sessionId: 'session2',
          sourceLanguage: 'en',
          targetLanguage: 'de',
          originalText: 'Test',
          translatedText: 'Test',
          timestamp: new Date(twoHoursAgo), // Explicitly 2 hours ago
          latency: 150
        });

        // t4: Very Old (2 days ago) - should NOT be in recentTranslations
        await storage.addTranslation({
          sessionId: 'session3',
          sourceLanguage: 'de',
          targetLanguage: 'en',
          originalText: 'Alt',
          translatedText: 'Old',
          timestamp: new Date(twoDaysAgo),
          latency: 50
        });
        
        const metrics = await storage.getTranslationMetrics();
        
        expect(metrics.totalTranslations).toBe(4);
        expect(metrics.averageLatency).toBeCloseTo((100 + 200 + 150 + 50) / 4);
        // t1 (30m ago) and t2 (1h ago) are recent. t3 (2h ago) and t4 (2d ago) are not.
        expect(metrics.recentTranslations).toBe(2); 
        vi.useRealTimers();
      });

      it('should correctly calculate translation metrics when no timeRange is provided', async () => {
        // For this test, ensure fake timers are used if precise control over "recent" is needed,
        // or ensure test execution is fast enough for new Date() to be within the "recent" window.
        // Current MemStorage `addTranslation` uses `new Date()` if timestamp is not provided.
        // `recentTranslations` is defined as last 1 hour.
        vi.useFakeTimers();
        const now = Date.now();
        vi.setSystemTime(now); // Fix current time

        // Add translations without explicit timestamps; they will get `now` as timestamp
        await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Hello', translatedText: 'Hola', latency: 100, sessionId: 's1' });
        await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'World', translatedText: 'Monde', latency: 150, sessionId: 's1' });
        await storage.addTranslation({ sourceLanguage: 'es', targetLanguage: 'en', originalText: 'Adiós', translatedText: 'Goodbye', latency: 120, sessionId: 's2' });
        
        const metrics = await storage.getTranslationMetrics(); // No timeRange
        expect(metrics.totalTranslations).toBe(3);
        expect(metrics.averageLatency).toBeCloseTo((100 + 150 + 120) / 3);
        // All 3 translations were just added, so they are "recent" (within the last hour)
        expect(metrics.recentTranslations).toBe(3); 
        vi.useRealTimers(); // Clean up fake timers
      });

      it('should ignore timeRange and calculate metrics for all translations', async () => {
        vi.useFakeTimers();
        const currentTime = Date.now();
        vi.setSystemTime(currentTime); // Fix current time for consistent "recent" calculation

        // TR1: 30 mins ago (IN RANGE for recentTranslations)
        // vi.setSystemTime(new Date(currentTime - 30 * 60 * 1000)); // Not needed, pass timestamp directly
        await storage.addTranslation({ 
          sourceLanguage: 'en', 
          targetLanguage: 'es', 
          originalText: 'tr1', 
          translatedText: 'tr1_es', 
          latency: 50, 
          timestamp: new Date(currentTime - 30 * 60 * 1000) 
        });

        // TR_OLD: 3 hours ago (OUT OF RANGE for recentTranslations)
        // vi.setSystemTime(new Date(currentTime - 3 * 60 * 60 * 1000)); // Not needed, pass timestamp directly
        await storage.addTranslation({ 
          sourceLanguage: 'en', 
          targetLanguage: 'fr', 
          originalText: 'trOld', 
          translatedText: 'trOld_fr', 
          latency: 250, 
          timestamp: new Date(currentTime - 3 * 60 * 60 * 1000) 
        });

        // vi.setSystemTime(new Date(currentTime)); // Already set

        const timeRange = { // This timeRange should be ignored by MemStorage
          startDate: new Date(currentTime - 60 * 60 * 1000), // 1 hour ago
          endDate: new Date(currentTime),
        };

        const metrics = await storage.getTranslationMetrics(timeRange);
        expect(metrics.totalTranslations).toBe(2); // Both tr1 and trOld
        expect(metrics.averageLatency).toBeCloseTo((50 + 250) / 2); // Average of tr1 and trOld
        // Only tr1 is recent (within last hour from currentTime)
        expect(metrics.recentTranslations).toBe(1); 
        vi.useRealTimers(); // Clean up fake timers
      });
    });

    describe('getLanguagePairUsage', () => { // Test suite for getLanguagePairUsage
      it('should return empty array if no translations', async () => {
        const metrics = await storage.getLanguagePairUsage();
        expect(metrics).toEqual([]);
      });

      it('should correctly count language pairs and calculate average latency', async () => {
        await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Test1', translatedText: 'Prueba1', latency: 100, sessionId: 's1' });
        await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Test2', translatedText: 'Prueba2', latency: 150, sessionId: 's1' });
        await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Test3', translatedText: 'Prueba3', latency: 100, sessionId: 's2' }); // Different session, same pair
        await storage.addTranslation({ sourceLanguage: 'fr', targetLanguage: 'de', originalText: 'Bonjour', translatedText: 'Hallo', latency: 200, sessionId: 's1' });

        const metrics = await storage.getLanguagePairUsage();
        
        // For 'en' -> 'es'
        const enEsPair = metrics.find(p => p.sourceLanguage === 'en' && p.targetLanguage === 'es');
        expect(enEsPair).toBeDefined();
        expect(enEsPair!.count).toBe(3);
        expect(enEsPair!.averageLatency).toBeCloseTo((100 + 150 + 100) / 3);

        // For 'fr' -> 'de'
        const frDePair = metrics.find(p => p.sourceLanguage === 'fr' && p.targetLanguage === 'de');
        expect(frDePair).toBeDefined();
        expect(frDePair!.count).toBe(1);
        expect(frDePair!.averageLatency).toBeCloseTo(200);
        
        expect(metrics.length).toBe(2); // Ensure only these two pairs are present
      });

      it('should ignore timeRange and calculate metrics for all language pairs', async () => {
        vi.useFakeTimers();
        const currentTime = Date.now();

        // Pair 1 item 1: en->es, 30 mins ago
        vi.setSystemTime(new Date(currentTime - 30 * 60 * 1000));
        await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'tr1', translatedText: 'tr1_es', latency: 50, timestamp: new Date(currentTime - 30 * 60 * 1000) });

        // Pair 2 item 1: fr->de, 2 hours ago
        vi.setSystemTime(new Date(currentTime - 2 * 60 * 60 * 1000));
        await storage.addTranslation({ sourceLanguage: 'fr', targetLanguage: 'de', originalText: 'trOld', translatedText: 'trOld_fr', latency: 250, timestamp: new Date(currentTime - 2 * 60 * 60 * 1000) });
        
        // Pair 1 item 2: en->es, 45 mins ago
        vi.setSystemTime(new Date(currentTime - 45 * 60 * 1000));
        await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'tr2', translatedText: 'tr2_es', latency: 70, timestamp: new Date(currentTime - 45 * 60 * 1000) });


        vi.setSystemTime(new Date(currentTime)); // Reset to current time for metrics call

        const timeRange = { // This timeRange should be ignored by MemStorage
          startDate: new Date(currentTime - 60 * 60 * 1000), // 1 hour ago
          endDate: new Date(currentTime),
        };

        const metrics = await storage.getLanguagePairUsage(timeRange);
        
        // Expect metrics for all pairs, ignoring the timeRange
        // Pair en->es: count = 2, latencies = [50, 70], avgLatency = (50+70)/2 = 60
        // Pair fr->de: count = 1, latencies = [250], avgLatency = 250
        expect(metrics).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ sourceLanguage: 'en', targetLanguage: 'es', count: 2, averageLatency: 60 }),
            expect.objectContaining({ sourceLanguage: 'fr', targetLanguage: 'de', count: 1, averageLatency: 250 }),
          ])
        );
        expect(metrics.length).toBe(2); // Ensure no other pairs are present
        vi.useRealTimers();
      });
    });

    describe('getRecentSessionActivity', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
      });

      it('should return an empty array if no sessions exist', async () => {
        const activity = await storage.getRecentSessionActivity(5);
        expect(activity).toEqual([]);
      });

      it('should return recent sessions ordered by startTime descending, respecting the limit', async () => {
        const baseTime = Date.now();

        // s3 created first (oldest startTime)
        vi.setSystemTime(new Date(baseTime - 3000)); // 3 seconds ago
        await storage.createSession({ sessionId: 's3', teacherLanguage: 'es-ES', studentsCount: 0 }); 
        
        // s2 created second
        vi.setSystemTime(new Date(baseTime - 2000)); // 2 seconds ago
        await storage.createSession({ sessionId: 's2', teacherLanguage: 'fr-FR', studentsCount: 2 }); 
        
        // s1 created last (most recent startTime)
        vi.setSystemTime(new Date(baseTime - 1000)); // 1 second ago
        await storage.createSession({ sessionId: 's1', teacherLanguage: 'en-US', studentsCount: 1 }); 

        vi.setSystemTime(new Date(baseTime)); // Reset to "now" for activity check

        // Adding a transcript to s3 to simulate activity; this should NOT affect getRecentSessionActivity's sorting
        // which is based on session.startTime in MemStorage.
        await storage.addTranscript({ sessionId: 's3', language: 'es-ES', text: 'activity update for s3' });

        const activity = await storage.getRecentSessionActivity(2); // Get the 2 most recent sessions
        
        expect(activity.length).toBe(2);
        // s1 should be first (most recent startTime)
        expect(activity[0].sessionId).toBe('s1');
        expect(activity[0].studentCount).toBe(1); 
        // s2 should be second 
        expect(activity[1].sessionId).toBe('s2');
        expect(activity[1].studentCount).toBe(2);

        // Verify startTimes are present and s1's is more recent than s2's
        expect(activity[0].startTime).toBeInstanceOf(Date);
        expect(activity[1].startTime).toBeInstanceOf(Date);
        if (activity[0].startTime && activity[1].startTime) {
             expect(activity[0].startTime.getTime()).toBeGreaterThan(activity[1].startTime.getTime());
        } else {
            throw new Error("Session start times should not be null");
        }
      });

      it('should return all sessions if limit is larger than the number of sessions, ordered by startTime', async () => {
        const baseTime = Date.now();
        // sA created first
        vi.setSystemTime(new Date(baseTime - 2000));
        await storage.createSession({ sessionId: 'sA', teacherLanguage: 'en-US', studentsCount: 1 });
        // sB created second (most recent startTime)
        vi.setSystemTime(new Date(baseTime - 1000));
        await storage.createSession({ sessionId: 'sB', teacherLanguage: 'fr-FR', studentsCount: 0 });

        vi.setSystemTime(new Date(baseTime));
        const activity = await storage.getRecentSessionActivity(5);
        
        expect(activity.length).toBe(2);
        expect(activity[0].sessionId).toBe('sB'); // sB is most recent by startTime
        expect(activity[1].sessionId).toBe('sA');
      });

      it('should correctly set studentsCount and handle default', async () => {
        await storage.createSession({ 
          sessionId: 'sWithStudents', 
          teacherLanguage: 'en-US', 
          studentsCount: 3 
        });
        await storage.createSession({ 
          sessionId: 'sWithoutStudents', 
          teacherLanguage: 'en-US', 
          studentsCount: 0 
        });
        await storage.createSession({ 
          sessionId: 'sNullStudents', // studentsCount will default to 0 as per schema
          teacherLanguage: 'en-US', 
        });

        const activity = await storage.getRecentSessionActivity(3);
        expect(activity.length).toBe(3); // All three sessions

        const sWith = activity.find(s => s.sessionId === 'sWithStudents');
        const sWithout = activity.find(s => s.sessionId === 'sWithoutStudents');
        const sNull = activity.find(s => s.sessionId === 'sNullStudents');

        expect(sWith?.studentCount).toBe(3);
        expect(sWithout?.studentCount).toBe(0);
        expect(sNull?.studentCount).toBe(0); // Default value
      });

      // Test getRecentSessionActivity
      it('should return recent session activity, sorted by startTime descending', async () => {
        const baseTime = Date.now();
        // Create sessions in a specific order to test sorting by startTime
        // s2 is created first, so it will have an earlier startTime
        vi.setSystemTime(new Date(baseTime - 2000));
        await storage.createSession({ sessionId: 's2', teacherLanguage: 'fr-FR', studentsCount: 2 });
        // s1 is created next
        vi.setSystemTime(new Date(baseTime - 1000));
        await storage.createSession({ sessionId: 's1', teacherLanguage: 'en-US', studentsCount: 1 });
        
        vi.setSystemTime(new Date(baseTime));
        // This update should not affect its original startTime for sorting purposes in MemStorage
        await storage.updateSession('s1', { totalTranslations: 5 });

        const activity = await storage.getRecentSessionActivity(2);
        expect(activity).toHaveLength(2);

        // MemSessionStorage.getRecentSessionActivity sorts by startTime descending.
        // s1 was created after s2, so it should appear first (more recent startTime).
        expect(activity[0].sessionId).toBe('s1'); 
        expect(activity[1].sessionId).toBe('s2'); 

        // Verify student counts
        expect(activity[0].studentCount).toBe(1);
        expect(activity[1].studentCount).toBe(2);

        // Check that startTimes are Date objects
        expect(activity[0].startTime).toBeInstanceOf(Date);
        expect(activity[1].startTime).toBeInstanceOf(Date);
        // Ensure s1's startTime is indeed greater (more recent) than s2's
        if (activity[0].startTime && activity[1].startTime) { // Type guard
          expect(activity[0].startTime.getTime()).toBeGreaterThan(activity[1].startTime.getTime());
        } else {
          // This case should not be reached if sessions are created correctly
          throw new Error('startTime should not be null for these sessions');
        }
      });

      it('should return empty array if no sessions for getRecentSessionActivity', async () => {
        const activity = await storage.getRecentSessionActivity(5);
        expect(activity).toEqual([]);
      });

      it('should limit recent session activity correctly', async () => {
        const baseTime = Date.now();
        // Create sessions in a specific order
        vi.setSystemTime(new Date(baseTime - 3000));
        await storage.createSession({ sessionId: 'sA', teacherLanguage: 'en-US', studentsCount: 1 }); // Oldest
        vi.setSystemTime(new Date(baseTime - 2000));
        await storage.createSession({ sessionId: 'sB', teacherLanguage: 'de-DE', studentsCount: 1 });
        vi.setSystemTime(new Date(baseTime - 1000));
        await storage.createSession({ sessionId: 'sC', teacherLanguage: 'es-ES', studentsCount: 1 }); // Newest
        
        vi.setSystemTime(new Date(baseTime));
        const activity = await storage.getRecentSessionActivity(2);
        expect(activity).toHaveLength(2);
        // sC should be first (newest), then sB
        expect(activity[0].sessionId).toBe('sC');
        expect(activity[1].sessionId).toBe('sB');
      });


      // Test getSessionById
      it('should retrieve a session by its ID', async () => {
        await storage.createSession({ sessionId: 's1-get', teacherLanguage: 'en-US', studentsCount: 1 });
        const session = await storage.getSessionById('s1-get');
        expect(session).toBeDefined();
        // Add a non-null assertion or check as session could be undefined
        if (session) {
          expect(session.sessionId).toBe('s1-get');
          expect(session.studentsCount).toBe(1);
        } else {
          // This case should not be reached if the session was created
          throw new Error('Session s1-get should be defined');
        }
      });

      // Test createSession with varying student counts
      it('should correctly set studentsCount when creating a session', async () => {
        const session1 = await storage.createSession({
          sessionId: 'sessionWithThreeStudents',
          teacherLanguage: 'en-US',
          studentsCount: 3
        });
        expect(session1.studentsCount).toBe(3);

        const session2 = await storage.createSession({
          sessionId: 'sessionWithZeroStudents',
          teacherLanguage: 'en-US',
          studentsCount: 0 // Explicitly testing 0
        });
        expect(session2.studentsCount).toBe(0);

        const session3 = await storage.createSession({
          sessionId: 'sessionWithDefaultStudents', // studentsCount is optional in InsertSession
          teacherLanguage: 'ja-JP'
        });
        // Default value for studentsCount in the schema is 0
        expect(session3.studentsCount).toBe(0); 
      });
    });

    // DatabaseStorage specific tests (mocked)
    describe('DatabaseStorage', () => {
      let storage: IStorage;

      beforeEach(() => {
        storage = new DatabaseStorage();
      });

      it('should initialize with an empty state', async () => {
        const languages = await storage.getLanguages();
        expect(languages).toEqual([]);
        
        // Test that we can query for active languages (should be empty)
        const activeLanguages = await storage.getActiveLanguages();
        expect(activeLanguages).toEqual([]);
        
        // Test session metrics (should show zero sessions)
        const sessionMetrics = await storage.getSessionMetrics();
        expect(sessionMetrics.totalSessions).toBe(0);
        expect(sessionMetrics.activeSessions).toBe(0);
      });

      // Add more mocked tests for DatabaseStorage methods...
    });

  }); // End of MemStorage describe block

  // If DatabaseStorage tests are also part of this file, they would typically follow here.
  // describe('DatabaseStorage', () => {
  //   // Mocked tests for DatabaseStorage would go here
  // });

}); // End of the main describe block for Storage Services
