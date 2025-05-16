/**
 * Database Storage Integration Tests
 * 
 * Tests the PostgreSQL storage implementation using a real database connection
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseStorage } from '../../../server/storage';
import { db } from '../../../server/db';
import { users, languages, translations, transcripts } from '../../../shared/schema';

describe('DatabaseStorage Integration Tests', () => {
  let storage: DatabaseStorage;

  // Set up the storage and clean the database before tests
  beforeAll(async () => {
    storage = new DatabaseStorage();
    
    // Clean the database tables except for languages (which has default values)
    await db.delete(users);
    await db.delete(translations);
    await db.delete(transcripts);
  });

  describe('User operations', () => {
    beforeEach(async () => {
      // Clean up users before each test
      await db.delete(users);
    });

    it('should create and retrieve a user', async () => {
      // Arrange
      const testUser = {
        username: 'testuser',
        password: 'password123'
      };
      
      // Act
      const createdUser = await storage.createUser(testUser);
      const retrievedUser = await storage.getUser(createdUser.id);
      
      // Assert
      expect(createdUser).toHaveProperty('id');
      expect(createdUser.username).toEqual(testUser.username);
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should retrieve a user by username', async () => {
      // Arrange
      const testUser = {
        username: 'username_lookup_test',
        password: 'password123'
      };
      
      // Act
      const createdUser = await storage.createUser(testUser);
      const retrievedUser = await storage.getUserByUsername(testUser.username);
      
      // Assert
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return undefined for non-existent user', async () => {
      // Act
      const nonExistentUser = await storage.getUser(9999);
      
      // Assert
      expect(nonExistentUser).toBeUndefined();
    });
  });

  describe('Language operations', () => {
    it('should retrieve all languages', async () => {
      // Act
      const allLanguages = await storage.getLanguages();
      
      // Assert
      expect(allLanguages.length).toBeGreaterThan(0);
      expect(allLanguages[0]).toHaveProperty('id');
      expect(allLanguages[0]).toHaveProperty('code');
      expect(allLanguages[0]).toHaveProperty('name');
    });

    it('should retrieve active languages', async () => {
      // Act
      const activeLanguages = await storage.getActiveLanguages();
      
      // Assert
      expect(activeLanguages.length).toBeGreaterThan(0);
      expect(activeLanguages.every(lang => lang.isActive)).toBe(true);
    });

    it('should retrieve a language by code', async () => {
      // Arrange
      const englishCode = 'en-US';
      
      // Act
      const language = await storage.getLanguageByCode(englishCode);
      
      // Assert
      expect(language).not.toBeUndefined();
      expect(language?.code).toEqual(englishCode);
    });

    it('should create a new language', async () => {
      // Arrange
      const newLanguage = {
        code: `test-lang-${Date.now()}`,
        name: 'Test Language',
        isActive: true
      };
      
      // Act
      const createdLanguage = await storage.createLanguage(newLanguage);
      
      // Assert
      expect(createdLanguage).toHaveProperty('id');
      expect(createdLanguage.code).toEqual(newLanguage.code);
      expect(createdLanguage.name).toEqual(newLanguage.name);
    });

    it('should update language status', async () => {
      // Arrange
      const newLanguage = {
        code: `update-test-${Date.now()}`,
        name: 'Update Test Language',
        isActive: true
      };
      const createdLanguage = await storage.createLanguage(newLanguage);
      
      // Act
      const updatedLanguage = await storage.updateLanguageStatus(createdLanguage.code, false);
      
      // Assert
      expect(updatedLanguage).not.toBeUndefined();
      expect(updatedLanguage?.isActive).toBe(false);
    });
  });

  describe('Translation operations', () => {
    beforeEach(async () => {
      // Clean translations before each test
      await db.delete(translations);
    });

    it('should add a translation', async () => {
      // Arrange
      const translation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 150
      };
      
      // Act
      const savedTranslation = await storage.addTranslation(translation);
      
      // Assert
      expect(savedTranslation).toHaveProperty('id');
      expect(savedTranslation.sourceLanguage).toEqual(translation.sourceLanguage);
      expect(savedTranslation.targetLanguage).toEqual(translation.targetLanguage);
      expect(savedTranslation.originalText).toEqual(translation.originalText);
      expect(savedTranslation.translatedText).toEqual(translation.translatedText);
    });

    it('should retrieve translations by language', async () => {
      // Arrange
      const targetLanguage = 'fr';
      const translations = [
        {
          sourceLanguage: 'en-US',
          targetLanguage,
          originalText: 'Hello',
          translatedText: 'Bonjour',
          latency: 100
        },
        {
          sourceLanguage: 'en-US',
          targetLanguage,
          originalText: 'Goodbye',
          translatedText: 'Au revoir',
          latency: 120
        }
      ];
      
      // Add test translations
      await Promise.all(translations.map(t => storage.addTranslation(t)));
      
      // Act
      const retrievedTranslations = await storage.getTranslationsByLanguage(targetLanguage);
      
      // Assert
      expect(retrievedTranslations.length).toEqual(translations.length);
      expect(retrievedTranslations[0].targetLanguage).toEqual(targetLanguage);
    });
  });

  describe('Transcript operations', () => {
    beforeEach(async () => {
      // Clean transcripts before each test
      await db.delete(transcripts);
    });

    it('should add a transcript', async () => {
      // Arrange
      const transcript = {
        sessionId: 'test-session-1',
        language: 'en-US',
        text: 'This is a test transcript'
      };
      
      // Act
      const savedTranscript = await storage.addTranscript(transcript);
      
      // Assert
      expect(savedTranscript).toHaveProperty('id');
      expect(savedTranscript.sessionId).toEqual(transcript.sessionId);
      expect(savedTranscript.language).toEqual(transcript.language);
      expect(savedTranscript.text).toEqual(transcript.text);
    });

    it('should retrieve transcripts by session and language', async () => {
      // Arrange
      const sessionId = 'test-session-2';
      const language = 'en-US';
      const transcripts = [
        {
          sessionId,
          language,
          text: 'First part of transcript'
        },
        {
          sessionId,
          language,
          text: 'Second part of transcript'
        },
        {
          sessionId: 'different-session',
          language,
          text: 'Different session transcript'
        }
      ];
      
      // Add test transcripts
      await Promise.all(transcripts.map(t => storage.addTranscript(t)));
      
      // Act
      const retrievedTranscripts = await storage.getTranscriptsBySession(sessionId, language);
      
      // Assert
      expect(retrievedTranscripts.length).toEqual(2); // Only the ones matching both sessionId and language
      expect(retrievedTranscripts[0].sessionId).toEqual(sessionId);
      expect(retrievedTranscripts[0].language).toEqual(language);
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    // No need to delete all data, but can clean up test data if needed
  });
});