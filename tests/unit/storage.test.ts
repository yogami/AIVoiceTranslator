/**
 * Storage Tests (Consolidated)
 * 
 * A comprehensive test suite for the MemStorage implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IStorage, MemStorage } from '../../server/storage';
import { 
  type User, type InsertUser,
  type Language, type InsertLanguage,
  type Translation, type InsertTranslation,
  type Transcript, type InsertTranscript,
  type Session, type InsertSession
} from '../../shared/schema';

describe('Storage Services', () => {
  describe('MemStorage', () => {
    let storage: IStorage;

    beforeEach(() => {
      storage = new MemStorage();
    });

    it('should initialize with default languages', async () => {
      // Act
      const result = await storage.getLanguages();
      
      // Assert
      expect(result.length).toBeGreaterThan(0);
      
      // Verify it contains expected languages
      const english = result.find(lang => lang.code === 'en-US');
      const spanish = result.find(lang => lang.code === 'es');
      
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
      const foundInActive = activeLanguages.some(lang => lang.code === testCode);
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
      
      const found = retrievedTranslations.find(t => t.id === savedTranslation.id);
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
      const newLang: InsertLanguage = { code: 'fr-FR', name: 'French (France)', isActive: true };
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
      const newUser: InsertUser = { username: 'userByIdTest', password: 'password' };
      const createdUser = await storage.createUser(newUser);
      expect(createdUser.id).toBeDefined();

      const retrievedUser = await storage.getUser(createdUser.id);
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return undefined for a non-existent user ID', async () => {
      const retrievedUser = await storage.getUser(99999);
      expect(retrievedUser).toBeUndefined();
    });

    // Session method tests
    it('should create a new session', async () => {
      const newSessionData: InsertSession = { sessionId: 'session123', teacherLanguage: 'en-US' };
      const session = await storage.createSession(newSessionData);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.sessionId).toBe('session123');
      expect(session.isActive).toBe(true);
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.endTime).toBeNull();
    });

    it('should retrieve an active session', async () => {
      const newSessionData: InsertSession = { sessionId: 'session-active', teacherLanguage: 'fr-FR' };
      await storage.createSession(newSessionData);
      const activeSession = await storage.getActiveSession('session-active');
      expect(activeSession).toBeDefined();
      expect(activeSession?.sessionId).toBe('session-active');
      expect(activeSession?.isActive).toBe(true);
    });

    it('should update an existing session', async () => {
      const newSessionData: InsertSession = { sessionId: 'session-update', studentsCount: 1 };
      const createdSession = await storage.createSession(newSessionData);
      const updates: Partial<InsertSession> = { studentsCount: 5, averageLatency: 120 };
      const updatedSession = await storage.updateSession('session-update', updates);
      expect(updatedSession).toBeDefined();
      expect(updatedSession?.studentsCount).toBe(5);
      expect(updatedSession?.averageLatency).toBe(120);
      expect(updatedSession?.id).toBe(createdSession.id);
    });

    it('should retrieve all active sessions', async () => {
      await storage.createSession({ sessionId: 's1', isActive: true });
      await storage.createSession({ sessionId: 's2', isActive: false }); // inactive
      await storage.createSession({ sessionId: 's3', isActive: true });
      const activeSessions = await storage.getAllActiveSessions();
      expect(activeSessions.length).toBe(2);
      expect(activeSessions.some(s => s.sessionId === 's1')).toBe(true);
      expect(activeSessions.some(s => s.sessionId === 's3')).toBe(true);
    });

    it('should end an active session', async () => {
      await storage.createSession({ sessionId: 'session-to-end', isActive: true });
      const endedSession = await storage.endSession('session-to-end');
      expect(endedSession).toBeDefined();
      expect(endedSession?.isActive).toBe(false);
      expect(endedSession?.endTime).toBeInstanceOf(Date);
      const retrievedAfterEnd = await storage.getActiveSession('session-to-end');
      expect(retrievedAfterEnd).toBeUndefined();
    });

    it('should return undefined when trying to end a non-existent or inactive session', async () => {
      const result = await storage.endSession('non-existent-session');
      expect(result).toBeUndefined();
    });

    // Analytics method tests
    it('should retrieve translations by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'text1', translatedText: 'texto1', timestamp: yesterday });
      await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'text2', translatedText: 'texte2', timestamp: now });
      await storage.addTranslation({ sourceLanguage: 'en', targetLanguage: 'de', originalText: 'text3', translatedText: 'text3', timestamp: tomorrow });

      const results = await storage.getTranslationsByDateRange(yesterday, now);
      expect(results.length).toBe(2);
      expect(results.some(t => t.originalText === 'text1')).toBe(true);
      expect(results.some(t => t.originalText === 'text2')).toBe(true);
    });

    it('should return placeholder analytics for getSessionAnalytics', async () => {
      // This test verifies the current placeholder implementation.
      // It should be updated if/when getSessionAnalytics is fully implemented for MemStorage.
      const analytics = await storage.getSessionAnalytics('any-session-id');
      expect(analytics).toBeDefined();
      expect(analytics.totalTranslations).toBe(0); // Based on current placeholder
      expect(analytics.averageLatency).toBe(0);    // Based on current placeholder
      expect(analytics.languagePairs).toEqual([]); // Based on current placeholder
    });

    // All IStorage methods for MemStorage appear to have basic test coverage now.
    // Further tests could cover more edge cases or specific data scenarios if needed.
  });
});
