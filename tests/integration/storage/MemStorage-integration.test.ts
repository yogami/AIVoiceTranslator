import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Import TestableMemStorage instead of MemStorage directly for testing
import { TestableMemStorage } from './TestableMemStorage'; 
import { type IStorage } from '../../../server/storage.interface';
import { 
  type InsertSession, 
  type Session, 
  type InsertUser, 
  type User,
  type InsertLanguage,
  type Language,
  type InsertTranscript,
  type Transcript,
  type InsertTranslation,
  type Translation
} from '../../../shared/schema';

describe('MemStorage Integration Tests', () => {
  let storage: IStorage; // Still type as IStorage to test against the interface

  beforeEach(async () => {
    // Instantiate the TestableMemStorage
    const testableMemStorageInstance = new TestableMemStorage();
    // Await the completion of asynchronous initialization tasks
    await testableMemStorageInstance.ensureInitialized();
    storage = testableMemStorageInstance; // Assign to IStorage typed variable
  });

  describe('Session Management', () => {
    it('should create and retrieve an active session', async () => {
      const sessionData: InsertSession = {
        sessionId: 'session-123',
        teacherLanguage: 'en-US',
        isActive: true,
        // studentsCount, totalTranslations, averageLatency are optional in InsertSession
      };
      const createdSession = await storage.createSession(sessionData);

      expect(createdSession).toBeDefined();
      expect(createdSession.id).toBeTypeOf('number');
      expect(createdSession.sessionId).toBe('session-123');
      expect(createdSession.teacherLanguage).toBe('en-US');
      expect(createdSession.isActive).toBe(true);
      expect(createdSession.startTime).toBeInstanceOf(Date);

      const retrievedSession = await storage.getActiveSession('session-123');
      expect(retrievedSession).toEqual(createdSession);
    });

    it('should update a session', async () => {
      const initialSessionData: InsertSession = { sessionId: 'session-to-update' };
      const createdSession = await storage.createSession(initialSessionData);

      const updates: Partial<InsertSession> = { studentsCount: 5, isActive: true };
      const updatedSession = await storage.updateSession(createdSession.sessionId, updates);

      expect(updatedSession).toBeDefined();
      expect(updatedSession?.studentsCount).toBe(5);
      expect(updatedSession?.isActive).toBe(true);

      const retrievedSession = await storage.getActiveSession(createdSession.sessionId);
      expect(retrievedSession?.studentsCount).toBe(5);
    });

    it('should end an active session', async () => {
      const sessionData: InsertSession = { sessionId: 'session-to-end', isActive: true };
      const createdSession = await storage.createSession(sessionData);

      const endedSession = await storage.endSession(createdSession.sessionId);
      expect(endedSession).toBeDefined();
      expect(endedSession?.isActive).toBe(false);
      expect(endedSession?.endTime).toBeInstanceOf(Date);

      const retrievedSession = await storage.getActiveSession(createdSession.sessionId);
      expect(retrievedSession).toBeUndefined(); // Should not be found as active
    });

    it('should get all active sessions', async () => {
      await storage.createSession({ sessionId: 'active-1', isActive: true });
      // Create an inactive session by first creating it active, then ending it.
      const inactiveSession = await storage.createSession({ sessionId: 'inactive-1', isActive: true });
      await storage.endSession(inactiveSession.sessionId);
      await storage.createSession({ sessionId: 'active-2', isActive: true });

      const activeSessions = await storage.getAllActiveSessions();
      expect(activeSessions.length).toBe(2);
      expect(activeSessions.every(s => s.isActive)).toBe(true);
      expect(activeSessions.find(s => s.sessionId === 'active-1')).toBeDefined();
      expect(activeSessions.find(s => s.sessionId === 'active-2')).toBeDefined();
    });
  });

  describe('User Management', () => {
    it('should create and retrieve a user', async () => {
      const userData: InsertUser = { username: 'testuser', password: 'password123' };
      const createdUser = await storage.createUser(userData);

      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBeTypeOf('number');
      expect(createdUser.username).toBe('testuser');
      expect(createdUser.password).toBe('password123');


      const retrievedById = await storage.getUser(createdUser.id);
      expect(retrievedById).toEqual(createdUser);

      const retrievedByUsername = await storage.getUserByUsername('testuser');
      expect(retrievedByUsername).toEqual(createdUser);
    });

    it('should not create a user with a duplicate username', async () => {
      const userData: InsertUser = { username: 'duplicateuser', password: 'password123' };
      await storage.createUser(userData);
      await expect(storage.createUser(userData)).rejects.toThrowError(/duplicate/i);
    });
  });

  describe('Language Management', () => {
    // MemStorage constructor calls initializeDefaultLanguages.
    it('should list default languages and allow creating a new one', async () => {
      const initialLanguages = await storage.getLanguages();
      const defaultLanguageCount = initialLanguages.length;
      // Default languages are defined in MemLanguageStorage's initializeDefaultLanguages
      expect(defaultLanguageCount).toBe(10); 

      const newLangData: InsertLanguage = { code: 'xx-YY', name: 'Test Language', isActive: true };
      const createdLang = await storage.createLanguage(newLangData);
      expect(createdLang.code).toBe('xx-YY');

      const allLanguages = await storage.getLanguages();
      expect(allLanguages.length).toBe(defaultLanguageCount + 1);

      const retrievedByCode = await storage.getLanguageByCode('xx-YY');
      expect(retrievedByCode).toEqual(createdLang);
    });

    it('should get active languages', async () => {
      // All default languages are initialized as active.
      const defaultActiveCount = 10;
      await storage.createLanguage({ code: 'inactive-lang', name: 'Inactive Test', isActive: false });
      
      const activeLanguages = await storage.getActiveLanguages();
      
      expect(activeLanguages.every(lang => lang.isActive)).toBe(true);
      expect(activeLanguages.find(lang => lang.code === 'inactive-lang')).toBeUndefined();
      expect(activeLanguages.length).toBe(defaultActiveCount);
    });

    it('should update language status', async () => {
      const langToUpdateCode = 'en-US'; // This is a default language
      
      const updatedLang = await storage.updateLanguageStatus(langToUpdateCode, false);
      expect(updatedLang?.isActive).toBe(false);

      const retrievedLang = await storage.getLanguageByCode(langToUpdateCode);
      expect(retrievedLang?.isActive).toBe(false);

      await storage.updateLanguageStatus(langToUpdateCode, true); // Revert for other tests
      const revertedLang = await storage.getLanguageByCode(langToUpdateCode);
      expect(revertedLang?.isActive).toBe(true);
    });
  });

  describe('Transcript Management', () => {
    it('should add and retrieve transcripts for a session', async () => {
      const sessionData: InsertSession = { sessionId: 'transcript-session-1' };
      await storage.createSession(sessionData);

      const transcript1: InsertTranscript = { sessionId: 'transcript-session-1', language: 'en-US', text: 'Hello world' };
      // Simulate a slight delay for timestamp sorting
      await new Promise(resolve => setTimeout(resolve, 10));
      const transcript2: InsertTranscript = { sessionId: 'transcript-session-1', language: 'en-US', text: 'Testing testing' };
      
      await storage.addTranscript(transcript1);
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      await storage.addTranscript(transcript2);

      const transcripts = await storage.getTranscriptsBySession('transcript-session-1', 'en-US');
      expect(transcripts.length).toBe(2);
      // Transcripts are sorted by timestamp descending in MemTranscriptStorage
      expect(transcripts[0].text).toBe('Testing testing');
      expect(transcripts[1].text).toBe('Hello world');
    });
  });

  describe('Translation Management', () => {
    it('should add and retrieve translations', async () => {
      const translationData: InsertTranslation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello',
        translatedText: 'Hola',
        sessionId: 'translation-session-1', // sessionId is part of InsertTranslation via $inferInsert
        latency: 100
      };
      const createdTranslation = await storage.addTranslation(translationData);
      expect(createdTranslation.id).toBeTypeOf('number');
      expect(createdTranslation.originalText).toBe('Hello');

      const translations = await storage.getTranslations(5);
      expect(translations.some(t => t.id === createdTranslation.id)).toBe(true);

      const byLang = await storage.getTranslationsByLanguage('es-ES');
      expect(byLang.some(t => t.id === createdTranslation.id)).toBe(true);
    });

    it('should retrieve translations by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      await storage.addTranslation({
        sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'ancient', translatedText: 'ancien',
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000) // 3 hours ago
      });
      const t1 = await storage.addTranslation({
        sourceLanguage: 'en', targetLanguage: 'de', originalText: 'recent1', translatedText: 'aktuell1',
        timestamp: oneHourAgo
      });
       await storage.addTranslation({
        sourceLanguage: 'en', targetLanguage: 'it', originalText: 'recent2', translatedText: 'recente2',
        timestamp: now
      });

      const rangeResults = await storage.getTranslationsByDateRange(twoHoursAgo, now);
      expect(rangeResults.length).toBe(2);
      expect(rangeResults.some(t => t.id === t1.id)).toBe(true);
      expect(rangeResults.every(t => t.timestamp && new Date(t.timestamp) >= twoHoursAgo && new Date(t.timestamp) <= now)).toBe(true);
    });
  });

  describe('Analytics and Metrics', () => {
    let s1: Session, s2: Session;

    beforeEach(async () => {
      // Instantiate TestableMemStorage and ensure it's initialized *before* using fake timers.
      // This allows ensureInitialized's internal polling (with setTimeout) to use real timers.
      const testableMetricsStorage = new TestableMemStorage();
      await testableMetricsStorage.ensureInitialized();
      storage = testableMetricsStorage; // Assign the initialized storage instance

      vi.useFakeTimers(); // Now, enable fake timers for the rest of this specific setup.

      // Set time for s1 creation (5 minutes ago)
      const fiveMinutesAgo = Date.now() - 1000 * 60 * 5;
      vi.setSystemTime(fiveMinutesAgo);
      s1 = await storage.createSession({ sessionId: 'metrics-s1', teacherLanguage: 'en-US', isActive: true });
      
      // Set time for s2 creation (now, relative to the fake timer start)
      // To make s2 more "recent" than s1 for sorting, let's advance time a bit
      vi.advanceTimersByTime(1000 * 60); // Advance 1 minute
      const fourMinutesAgo = Date.now(); // This will be based on the advanced fake time
      vi.setSystemTime(fourMinutesAgo);
      s2 = await storage.createSession({ sessionId: 'metrics-s2', teacherLanguage: 'fr-FR', isActive: true });
      
      await storage.addTranscript({ sessionId: 'metrics-s1', language: 'en-US', text: 'Transcript 1 for s1' });
      await storage.addTranscript({ sessionId: 'metrics-s1', language: 'en-US', text: 'Transcript 2 for s1' });

      await storage.addTranslation({ sourceLanguage: 'en-US', targetLanguage: 'es-ES', originalText: 'One', translatedText: 'Uno', sessionId: 'metrics-s1', latency: 50 });
      await storage.addTranslation({ sourceLanguage: 'en-US', targetLanguage: 'fr-FR', originalText: 'Two', translatedText: 'Deux', sessionId: 'metrics-s1', latency: 60 });
      await storage.addTranslation({ sourceLanguage: 'fr-FR', targetLanguage: 'en-US', originalText: 'Trois', translatedText: 'Three', sessionId: 'metrics-s2', latency: 70 });
      
      // Set time for ending session s1 (current fake time, which is "now" after advancements)
      vi.setSystemTime(Date.now() + 1000 * 60 * 4); // "Now" is 5 minutes after s1 was created
      await storage.endSession(s1.sessionId);
    });

    afterEach(() => {
      vi.useRealTimers(); // Restore real timers after each test in this block
    });

    it('should get session analytics for a specific session', async () => {
      const analytics = await storage.getSessionAnalytics('metrics-s1');
      expect(analytics.totalTranslations).toBe(2);
      expect(analytics.averageLatency).toBe((50 + 60) / 2);
      expect(analytics.languagePairs.length).toBe(2); 
      expect(analytics.languagePairs.find(p => p.sourceLanguage === 'en-US' && p.targetLanguage === 'es-ES')?.count).toBe(1);
    });

    it('should get session metrics', async () => {
      const metrics = await storage.getSessionMetrics(); 
      expect(metrics.totalSessions).toBe(2); 
      expect(metrics.activeSessions).toBe(1); 
      expect(metrics.averageSessionDuration).toBeGreaterThan(0); 
      // s1 duration is exactly 5 minutes (300000 ms) because we controlled time
      expect(metrics.averageSessionDuration).toBeCloseTo(1000 * 60 * 5, -2); 
      // sessionsLast24Hours is not in IStorage, so not tested here
    });

    it('should get translation metrics', async () => {
      const metrics = await storage.getTranslationMetrics();
      expect(metrics.totalTranslations).toBe(3);
      expect(metrics.averageLatency).toBeCloseTo((50 + 60 + 70) / 3);
      expect(metrics.recentTranslations).toBe(3); // All 3 were created recently
    });

    it('should get language pair metrics', async () => {
      const metrics = await storage.getLanguagePairMetrics();
      expect(metrics.length).toBe(3); // en-US -> es-ES, en-US -> fr-FR, fr-FR -> en-US
      const enEsPair = metrics.find(p => p.sourceLanguage === 'en-US' && p.targetLanguage === 'es-ES');
      expect(enEsPair).toBeDefined();
      expect(enEsPair?.count).toBe(1);
      expect(enEsPair?.averageLatency).toBe(50);
    });
    
    it('should get recent session activity', async () => {
      const activity = await storage.getRecentSessionActivity(5);
      expect(activity.length).toBe(2); 
      
      const s1Activity = activity.find(a => a.sessionId === 'metrics-s1');
      expect(s1Activity).toBeDefined();
      expect(s1Activity?.teacherLanguage).toBe('en-US');
      expect(s1Activity?.transcriptCount).toBe(2); 
      expect(s1Activity?.duration).toBeGreaterThan(0);
      expect(s1Activity?.duration).toBeCloseTo(1000 * 60 * 5, -2); // s1 duration is 5 minutes


      const s2Activity = activity.find(a => a.sessionId === 'metrics-s2');
      expect(s2Activity).toBeDefined();
      expect(s2Activity?.teacherLanguage).toBe('fr-FR');
      expect(s2Activity?.transcriptCount).toBe(0);
      expect(s2Activity?.duration).toBe(0); // s2 was not ended
    });
  });
});
