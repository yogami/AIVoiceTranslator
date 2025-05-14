import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../../server/storage';
import type {
  InsertUser,
  InsertLanguage,
  InsertTranslation,
  InsertTranscript,
  User,
  Language,
  Translation,
  Transcript
} from '../../shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  // User method tests
  describe('User Methods', () => {
    const testUser: InsertUser = {
      username: 'testuser',
      password: 'password123'
    };

    it('should create a user', async () => {
      const createdUser = await storage.createUser(testUser);
      
      expect(createdUser).toMatchObject({
        ...testUser,
        id: expect.any(Number)
      });
    });

    it('should get a user by id', async () => {
      const createdUser = await storage.createUser(testUser);
      const retrievedUser = await storage.getUser(createdUser.id);
      
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return undefined for non-existent user id', async () => {
      const user = await storage.getUser(999);
      expect(user).toBeUndefined();
    });

    it('should get a user by username', async () => {
      const createdUser = await storage.createUser(testUser);
      const retrievedUser = await storage.getUserByUsername(testUser.username);
      
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return undefined for non-existent username', async () => {
      const user = await storage.getUserByUsername('nonexistentuser');
      expect(user).toBeUndefined();
    });
  });

  // Language method tests
  describe('Language Methods', () => {
    const testLanguage: InsertLanguage = {
      code: 'fr-CA',
      name: 'French (Canada)',
      isActive: true
    };

    it('should create a language', async () => {
      const createdLanguage = await storage.createLanguage(testLanguage);
      
      expect(createdLanguage).toMatchObject({
        ...testLanguage,
        id: expect.any(Number)
      });
    });

    it('should get all languages including default ones', async () => {
      const languages = await storage.getLanguages();
      
      // Check if default languages are created (at least 4)
      expect(languages.length).toBeGreaterThanOrEqual(4);
      
      // Verify default languages
      const defaultCodes = ['en-US', 'es', 'de', 'fr'];
      for (const code of defaultCodes) {
        const language = languages.find(l => l.code === code);
        expect(language).toBeDefined();
      }
    });

    it('should get only active languages', async () => {
      // Create an inactive language
      await storage.createLanguage({
        code: 'it',
        name: 'Italian',
        isActive: false
      });
      
      const activeLanguages = await storage.getActiveLanguages();
      
      // All returned languages should be active
      expect(activeLanguages.every(lang => lang.isActive)).toBe(true);
      
      // The inactive language should not be in the results
      expect(activeLanguages.find(lang => lang.code === 'it')).toBeUndefined();
    });

    it('should get a language by code', async () => {
      await storage.createLanguage(testLanguage);
      const language = await storage.getLanguageByCode(testLanguage.code);
      
      expect(language).toMatchObject(testLanguage);
    });

    it('should return undefined for non-existent language code', async () => {
      const language = await storage.getLanguageByCode('nonexistentcode');
      expect(language).toBeUndefined();
    });

    it('should update language status', async () => {
      // Create a language
      await storage.createLanguage(testLanguage);
      
      // Update its status to inactive
      const updatedLanguage = await storage.updateLanguageStatus(testLanguage.code, false);
      
      expect(updatedLanguage).toBeDefined();
      expect(updatedLanguage?.isActive).toBe(false);
      
      // Verify the update was persisted
      const retrievedLanguage = await storage.getLanguageByCode(testLanguage.code);
      expect(retrievedLanguage?.isActive).toBe(false);
    });

    it('should return undefined when updating non-existent language', async () => {
      const result = await storage.updateLanguageStatus('nonexistentcode', false);
      expect(result).toBeUndefined();
    });
  });

  // Translation method tests
  describe('Translation Methods', () => {
    const testTranslation: InsertTranslation = {
      sourceLanguage: 'en-US',
      targetLanguage: 'es',
      originalText: 'Hello, world!',
      translatedText: '¡Hola, mundo!',
      latency: 250
    };

    it('should add a translation', async () => {
      const addedTranslation = await storage.addTranslation(testTranslation);
      
      expect(addedTranslation).toMatchObject({
        ...testTranslation,
        id: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });

    it('should get translations by target language', async () => {
      // Add translations for multiple languages
      await storage.addTranslation(testTranslation);
      await storage.addTranslation({
        ...testTranslation,
        targetLanguage: 'fr',
        translatedText: 'Bonjour, monde!'
      });
      
      const spanishTranslations = await storage.getTranslationsByLanguage('es');
      const frenchTranslations = await storage.getTranslationsByLanguage('fr');
      
      expect(spanishTranslations.length).toBe(1);
      expect(frenchTranslations.length).toBe(1);
      expect(spanishTranslations[0].translatedText).toBe('¡Hola, mundo!');
      expect(frenchTranslations[0].translatedText).toBe('Bonjour, monde!');
    });

    it('should return an empty array for non-existent target language', async () => {
      const translations = await storage.getTranslationsByLanguage('nonexistentlanguage');
      expect(translations).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      // Add multiple translations for the same language
      for (let i = 0; i < 5; i++) {
        await storage.addTranslation({
          ...testTranslation,
          originalText: `Text ${i}`,
          translatedText: `Texto ${i}`
        });
      }
      
      const translations = await storage.getTranslationsByLanguage('es', 3);
      expect(translations.length).toBe(3);
    });

    it('should sort translations by timestamp in descending order', async () => {
      // Add translations with controlled timestamps
      for (let i = 0; i < 3; i++) {
        const translation = await storage.addTranslation({
          ...testTranslation,
          originalText: `Text ${i}`,
          translatedText: `Texto ${i}`
        });
        
        // Force the timestamp to be distinct
        // @ts-ignore - We're manipulating the private Map directly for testing
        storage.translations.set(translation.id, {
          ...translation,
          timestamp: new Date(Date.now() + i * 1000)
        });
      }
      
      const translations = await storage.getTranslationsByLanguage('es');
      
      // Verify descending order
      for (let i = 0; i < translations.length - 1; i++) {
        expect(translations[i].timestamp.getTime()).toBeGreaterThan(
          translations[i + 1].timestamp.getTime()
        );
      }
    });
  });

  // Transcript method tests
  describe('Transcript Methods', () => {
    const testTranscript: InsertTranscript = {
      sessionId: 'session123',
      language: 'en-US',
      text: 'This is a test transcript.'
    };

    it('should add a transcript', async () => {
      const addedTranscript = await storage.addTranscript(testTranscript);
      
      expect(addedTranscript).toMatchObject({
        ...testTranscript,
        id: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });

    it('should get transcripts by session ID and language', async () => {
      // Add transcripts for multiple sessions and languages
      await storage.addTranscript(testTranscript);
      await storage.addTranscript({
        ...testTranscript,
        sessionId: 'session456'
      });
      await storage.addTranscript({
        ...testTranscript,
        language: 'es'
      });
      
      const transcripts = await storage.getTranscriptsBySession('session123', 'en-US');
      
      expect(transcripts.length).toBe(1);
      expect(transcripts[0].text).toBe('This is a test transcript.');
    });

    it('should return an empty array for non-existent session or language', async () => {
      const transcripts = await storage.getTranscriptsBySession('nonexistentsession', 'en-US');
      expect(transcripts).toEqual([]);
    });

    it('should sort transcripts by timestamp in ascending order', async () => {
      // Add multiple transcripts for the same session with controlled timestamps
      for (let i = 0; i < 3; i++) {
        const transcript = await storage.addTranscript({
          ...testTranscript,
          text: `Transcript ${i}`
        });
        
        // Force the timestamp to be distinct but in reverse order
        // @ts-ignore - We're manipulating the private Map directly for testing
        storage.transcripts.set(transcript.id, {
          ...transcript,
          timestamp: new Date(Date.now() - i * 1000)
        });
      }
      
      const transcripts = await storage.getTranscriptsBySession('session123', 'en-US');
      
      // Verify ascending order
      for (let i = 0; i < transcripts.length - 1; i++) {
        expect(transcripts[i].timestamp.getTime()).toBeLessThan(
          transcripts[i + 1].timestamp.getTime()
        );
      }
    });
  });
});