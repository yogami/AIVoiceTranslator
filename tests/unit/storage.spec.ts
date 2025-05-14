/**
 * Tests for the Storage module
 * 
 * This file tests the MemStorage implementation of the IStorage interface
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemStorage } from '../../server/storage';
import type { InsertUser, InsertLanguage, InsertTranslation, InsertTranscript } from '../../shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;
  
  beforeEach(() => {
    // Create a fresh storage instance for each test
    storage = new MemStorage();
  });
  
  describe('User Methods', () => {
    it('should create and retrieve users', async () => {
      // Create a test user
      const insertUser: InsertUser = {
        username: 'testuser',
        password: 'password123'
      };
      
      // Add user to storage
      const user = await storage.createUser(insertUser);
      
      // Verify returned user
      expect(user).toMatchObject({
        id: expect.any(Number),
        username: 'testuser',
        password: 'password123'
      });
      
      // Verify we can retrieve the user by ID
      const retrievedUser = await storage.getUser(user.id);
      expect(retrievedUser).toEqual(user);
      
      // Verify we can retrieve the user by username
      const retrievedByUsername = await storage.getUserByUsername('testuser');
      expect(retrievedByUsername).toEqual(user);
    });
    
    it('should return undefined for non-existent users', async () => {
      // Attempt to retrieve a user that doesn't exist
      const nonExistentUser = await storage.getUser(999);
      expect(nonExistentUser).toBeUndefined();
      
      // Attempt to retrieve by a username that doesn't exist
      const nonExistentByUsername = await storage.getUserByUsername('notexist');
      expect(nonExistentByUsername).toBeUndefined();
    });
    
    it('should generate unique IDs for users', async () => {
      // Create multiple users
      const user1 = await storage.createUser({ username: 'user1', password: 'pwd1' });
      const user2 = await storage.createUser({ username: 'user2', password: 'pwd2' });
      
      // Verify IDs are unique
      expect(user1.id).not.toEqual(user2.id);
    });
  });
  
  describe('Language Methods', () => {
    it('should initialize with default languages', async () => {
      // A new storage instance should have default languages
      const languages = await storage.getLanguages();
      
      // Check we have the expected defaults
      expect(languages.length).toBeGreaterThanOrEqual(4);
      expect(languages.map(l => l.code)).toContain('en-US');
      expect(languages.map(l => l.code)).toContain('es');
      expect(languages.map(l => l.code)).toContain('de');
      expect(languages.map(l => l.code)).toContain('fr');
    });
    
    it('should create and retrieve languages', async () => {
      // Create a new language
      const insertLanguage: InsertLanguage = {
        code: 'ja-JP',
        name: 'Japanese',
        isActive: true
      };
      
      const language = await storage.createLanguage(insertLanguage);
      
      // Verify returned language
      expect(language).toMatchObject({
        id: expect.any(Number),
        code: 'ja-JP',
        name: 'Japanese',
        isActive: true
      });
      
      // Verify we can retrieve all languages including the new one
      const languages = await storage.getLanguages();
      expect(languages.some(l => l.code === 'ja-JP')).toBe(true);
      
      // Verify we can retrieve the language by code
      const retrievedByCode = await storage.getLanguageByCode('ja-JP');
      expect(retrievedByCode).toEqual(language);
    });
    
    it('should return active languages only', async () => {
      // First create one active and one inactive language
      await storage.createLanguage({
        code: 'it',
        name: 'Italian',
        isActive: true
      });
      
      await storage.createLanguage({
        code: 'ru',
        name: 'Russian',
        isActive: false
      });
      
      // Get active languages
      const activeLanguages = await storage.getActiveLanguages();
      
      // All returned languages should be active
      expect(activeLanguages.every(l => l.isActive)).toBe(true);
      
      // Should include the active language we created
      expect(activeLanguages.some(l => l.code === 'it')).toBe(true);
      
      // Should not include the inactive language
      expect(activeLanguages.some(l => l.code === 'ru')).toBe(false);
    });
    
    it('should update language status', async () => {
      // First, get an active language
      const language = await storage.getLanguageByCode('en-US');
      expect(language?.isActive).toBe(true);
      
      // Update it to inactive
      const updatedLanguage = await storage.updateLanguageStatus('en-US', false);
      expect(updatedLanguage?.isActive).toBe(false);
      
      // Verify the language is now inactive
      const retrievedLanguage = await storage.getLanguageByCode('en-US');
      expect(retrievedLanguage?.isActive).toBe(false);
      
      // Updating a non-existent language should return undefined
      const nonExistentUpdate = await storage.updateLanguageStatus('nonexistent', true);
      expect(nonExistentUpdate).toBeUndefined();
    });
  });
  
  describe('Translation Methods', () => {
    it('should add and retrieve translations', async () => {
      // Create a translation
      const insertTranslation: InsertTranslation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es',
        originalText: 'Hello',
        translatedText: 'Hola',
        latency: 200
      };
      
      const translation = await storage.addTranslation(insertTranslation);
      
      // Verify returned translation
      expect(translation).toMatchObject({
        id: expect.any(Number),
        sourceLanguage: 'en-US',
        targetLanguage: 'es',
        originalText: 'Hello',
        translatedText: 'Hola',
        latency: 200,
        timestamp: expect.any(Date)
      });
      
      // Verify we can retrieve translations by target language
      const retrievedTranslations = await storage.getTranslationsByLanguage('es');
      expect(retrievedTranslations.length).toBeGreaterThan(0);
      expect(retrievedTranslations[0]).toEqual(translation);
    });
    
    it('should retrieve translations with limit', async () => {
      // Add multiple translations
      for (let i = 0; i < 5; i++) {
        await storage.addTranslation({
          sourceLanguage: 'en-US',
          targetLanguage: 'fr',
          originalText: `Text ${i}`,
          translatedText: `Texte ${i}`,
          latency: 100 + i
        });
      }
      
      // Retrieve with limit of 3
      const limitedTranslations = await storage.getTranslationsByLanguage('fr', 3);
      
      // Should only return 3 translations
      expect(limitedTranslations.length).toBe(3);
    });
    
    it('should sort translations by timestamp in descending order', async () => {
      // Clear all existing translations by recreating storage
      storage = new MemStorage();
      
      // Add translations with different timestamps
      const translation1 = await storage.addTranslation({
        sourceLanguage: 'en-US',
        targetLanguage: 'de',
        originalText: 'First',
        translatedText: 'Erste',
        latency: 100
      });
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const translation2 = await storage.addTranslation({
        sourceLanguage: 'en-US',
        targetLanguage: 'de',
        originalText: 'Second',
        translatedText: 'Zweite',
        latency: 100
      });
      
      // Get translations
      const translations = await storage.getTranslationsByLanguage('de');
      
      // Should be sorted by timestamp descending (newest first)
      expect(translations[0].id).toBe(translation2.id);
      expect(translations[1].id).toBe(translation1.id);
    });
  });
  
  describe('Transcript Methods', () => {
    it('should add and retrieve transcripts by session', async () => {
      // Create transcripts for a session
      const sessionId = 'test-session-1';
      const language = 'en-US';
      
      const insertTranscript1: InsertTranscript = {
        sessionId,
        language,
        text: 'First transcript'
      };
      
      const insertTranscript2: InsertTranscript = {
        sessionId,
        language,
        text: 'Second transcript'
      };
      
      const transcript1 = await storage.addTranscript(insertTranscript1);
      const transcript2 = await storage.addTranscript(insertTranscript2);
      
      // Verify returned transcripts
      expect(transcript1).toMatchObject({
        id: expect.any(Number),
        sessionId,
        language,
        text: 'First transcript',
        timestamp: expect.any(Date)
      });
      
      expect(transcript2).toMatchObject({
        id: expect.any(Number),
        sessionId,
        language,
        text: 'Second transcript',
        timestamp: expect.any(Date)
      });
      
      // Retrieve transcripts for the session
      const transcripts = await storage.getTranscriptsBySession(sessionId, language);
      
      // Should have retrieved both transcripts
      expect(transcripts.length).toBe(2);
      expect(transcripts.map(t => t.id)).toContain(transcript1.id);
      expect(transcripts.map(t => t.id)).toContain(transcript2.id);
    });
    
    it('should filter transcripts by session and language', async () => {
      // Add transcripts with different sessions and languages
      const transcript1 = await storage.addTranscript({
        sessionId: 'session-a',
        language: 'en-US',
        text: 'English transcript'
      });
      
      const transcript2 = await storage.addTranscript({
        sessionId: 'session-a',
        language: 'es',
        text: 'Spanish transcript'
      });
      
      const transcript3 = await storage.addTranscript({
        sessionId: 'session-b',
        language: 'en-US',
        text: 'Different session transcript'
      });
      
      // Retrieve by session-a and en-US
      const transcriptsA_En = await storage.getTranscriptsBySession('session-a', 'en-US');
      expect(transcriptsA_En.length).toBe(1);
      expect(transcriptsA_En[0].id).toBe(transcript1.id);
      
      // Retrieve by session-a and es
      const transcriptsA_Es = await storage.getTranscriptsBySession('session-a', 'es');
      expect(transcriptsA_Es.length).toBe(1);
      expect(transcriptsA_Es[0].id).toBe(transcript2.id);
      
      // Retrieve by session-b and en-US
      const transcriptsB_En = await storage.getTranscriptsBySession('session-b', 'en-US');
      expect(transcriptsB_En.length).toBe(1);
      expect(transcriptsB_En[0].id).toBe(transcript3.id);
      
      // Retrieve by non-existent session
      const transcriptsNonExistent = await storage.getTranscriptsBySession('non-existent', 'en-US');
      expect(transcriptsNonExistent.length).toBe(0);
    });
    
    it('should sort transcripts by timestamp in ascending order', async () => {
      // Clear all existing transcripts by recreating storage
      storage = new MemStorage();
      const sessionId = 'time-sorted-session';
      const language = 'en-US';
      
      // Add transcripts with different timestamps
      const transcript1 = await storage.addTranscript({
        sessionId,
        language,
        text: 'First transcript'
      });
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const transcript2 = await storage.addTranscript({
        sessionId,
        language,
        text: 'Second transcript'
      });
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const transcript3 = await storage.addTranscript({
        sessionId,
        language,
        text: 'Third transcript'
      });
      
      // Get transcripts
      const transcripts = await storage.getTranscriptsBySession(sessionId, language);
      
      // Should be in chronological order (oldest first)
      expect(transcripts[0].id).toBe(transcript1.id);
      expect(transcripts[1].id).toBe(transcript2.id);
      expect(transcripts[2].id).toBe(transcript3.id);
    });
  });
});