/**
 * MemStorage Tests
 * 
 * Tests for the MemStorage class that implements the IStorage interface.
 * These tests verify in-memory data operations function correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  type User, type Language, type Translation, type Transcript,
  type InsertUser, type InsertLanguage, type InsertTranslation, type InsertTranscript
} from '../../../shared/schema';
import { MemStorage } from '../../../server/storage';

describe('MemStorage', () => {
  let memStorage: MemStorage;

  // Sample data for testing
  const testUser: InsertUser = {
    username: 'testuser',
    password: 'password123'
  };

  const testLanguage: InsertLanguage = {
    code: 'fr',
    name: 'French',
    isActive: true
  };

  const testTranslation: InsertTranslation = {
    sourceLanguage: 'en-US',
    targetLanguage: 'fr',
    originalText: 'Hello world',
    translatedText: 'Bonjour le monde',
    latency: 300
  };

  const testTranscript: InsertTranscript = {
    sessionId: 'memory-test-session-123',
    language: 'en-US',
    text: 'This is a memory storage test transcript'
  };

  beforeEach(() => {
    // Create a fresh MemStorage instance for each test
    memStorage = new MemStorage();
  });

  describe('User methods', () => {
    it('should create and retrieve a user by ID', async () => {
      // Create a user
      const createdUser = await memStorage.createUser(testUser);
      
      // Verify user was created with an ID
      expect(createdUser.id).toBeDefined();
      expect(createdUser.username).toBe(testUser.username);
      expect(createdUser.password).toBe(testUser.password);
      
      // Retrieve the user by ID
      const retrievedUser = await memStorage.getUser(createdUser.id);
      
      // Verify retrieved user matches created user
      expect(retrievedUser).toEqual(createdUser);
    });
    
    it('should return undefined for non-existent user ID', async () => {
      // Attempt to retrieve a user with a non-existent ID
      const user = await memStorage.getUser(999);
      
      // Verify result is undefined
      expect(user).toBeUndefined();
    });
    
    it('should retrieve a user by username', async () => {
      // Create a user
      const createdUser = await memStorage.createUser(testUser);
      
      // Retrieve the user by username
      const retrievedUser = await memStorage.getUserByUsername(testUser.username);
      
      // Verify retrieved user matches created user
      expect(retrievedUser).toEqual(createdUser);
    });
    
    it('should return undefined for non-existent username', async () => {
      // Attempt to retrieve a user with a non-existent username
      const user = await memStorage.getUserByUsername('nonexistentuser');
      
      // Verify result is undefined
      expect(user).toBeUndefined();
    });
  });
  
  describe('Language methods', () => {
    it('should create and retrieve a language', async () => {
      // Note: MemStorage initializes with default languages, so we'll add a new one
      const createdLanguage = await memStorage.createLanguage(testLanguage);
      
      // Verify language was created with an ID
      expect(createdLanguage.id).toBeDefined();
      expect(createdLanguage.code).toBe(testLanguage.code);
      expect(createdLanguage.name).toBe(testLanguage.name);
      expect(createdLanguage.isActive).toBe(testLanguage.isActive);
      
      // Retrieve the language by code
      const retrievedLanguage = await memStorage.getLanguageByCode(testLanguage.code);
      
      // Verify retrieved language matches created language
      expect(retrievedLanguage).toEqual(createdLanguage);
    });
    
    it('should get all languages', async () => {
      // Get all languages (including default ones)
      const languages = await memStorage.getLanguages();
      
      // Verify we have languages (at least the default ones)
      expect(languages.length).toBeGreaterThan(0);
      
      // Add a new language
      const createdLanguage = await memStorage.createLanguage(testLanguage);
      
      // Get all languages again
      const updatedLanguages = await memStorage.getLanguages();
      
      // Verify the new language is included
      expect(updatedLanguages.length).toBe(languages.length + 1);
      expect(updatedLanguages).toContainEqual(createdLanguage);
    });
    
    it('should get only active languages', async () => {
      // Create an active language
      const activeLanguage = await memStorage.createLanguage(testLanguage);
      
      // Create an inactive language
      const inactiveLanguage = await memStorage.createLanguage({
        code: 'it',
        name: 'Italian',
        isActive: false
      });
      
      // Get active languages
      const activeLanguages = await memStorage.getActiveLanguages();
      
      // Verify only active languages are returned
      expect(activeLanguages).toContainEqual(activeLanguage);
      expect(activeLanguages).not.toContainEqual(inactiveLanguage);
    });
    
    it('should update language status', async () => {
      // Create a language
      const language = await memStorage.createLanguage(testLanguage);
      
      // Update the language status to inactive
      const updatedLanguage = await memStorage.updateLanguageStatus(language.code, false);
      
      // Verify the language status was updated
      expect(updatedLanguage).toBeDefined();
      expect(updatedLanguage!.isActive).toBe(false);
      
      // Retrieve the language to verify the update was persisted
      const retrievedLanguage = await memStorage.getLanguageByCode(language.code);
      
      // Verify the language status change was persisted
      expect(retrievedLanguage).toBeDefined();
      expect(retrievedLanguage!.isActive).toBe(false);
    });
    
    it('should return undefined when updating non-existent language', async () => {
      // Update a non-existent language
      const result = await memStorage.updateLanguageStatus('nonexistentlanguage', false);
      
      // Verify the result is undefined
      expect(result).toBeUndefined();
    });
  });
  
  describe('Translation methods', () => {
    it('should add and retrieve translations', async () => {
      // Add a translation
      const addedTranslation = await memStorage.addTranslation(testTranslation);
      
      // Verify translation was added with an ID and timestamp
      expect(addedTranslation.id).toBeDefined();
      expect(addedTranslation.timestamp).toBeDefined();
      expect(addedTranslation.sourceLanguage).toBe(testTranslation.sourceLanguage);
      expect(addedTranslation.targetLanguage).toBe(testTranslation.targetLanguage);
      expect(addedTranslation.originalText).toBe(testTranslation.originalText);
      expect(addedTranslation.translatedText).toBe(testTranslation.translatedText);
      expect(addedTranslation.latency).toBe(testTranslation.latency);
      
      // Get translations by language
      const translations = await memStorage.getTranslationsByLanguage(testTranslation.targetLanguage);
      
      // Verify the translation is included in the results
      expect(translations).toContainEqual(addedTranslation);
    });
    
    it('should limit translations when requested', async () => {
      // Add multiple translations with the same target language
      for (let i = 0; i < 10; i++) {
        await memStorage.addTranslation({
          ...testTranslation,
          originalText: `Original text ${i}`,
          translatedText: `Texte original ${i}`
        });
      }
      
      // Get limited translations
      const limitedTranslations = await memStorage.getTranslationsByLanguage(testTranslation.targetLanguage, 5);
      
      // Verify the limit was applied
      expect(limitedTranslations.length).toBe(5);
    });
    
    it('should return translations in descending timestamp order', async () => {
      // Add translations with increasing delay to ensure different timestamps
      for (let i = 0; i < 5; i++) {
        // Add delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
        
        await memStorage.addTranslation({
          ...testTranslation,
          originalText: `Original text ${i}`,
          translatedText: `Texte original ${i}`
        });
      }
      
      // Get translations
      const translations = await memStorage.getTranslationsByLanguage(testTranslation.targetLanguage);
      
      // Verify translations are in descending timestamp order
      for (let i = 0; i < translations.length - 1; i++) {
        expect(translations[i].timestamp.getTime())
          .toBeGreaterThanOrEqual(translations[i + 1].timestamp.getTime());
      }
    });
  });
  
  describe('Transcript methods', () => {
    it('should add and retrieve transcripts', async () => {
      // Add a transcript
      const addedTranscript = await memStorage.addTranscript(testTranscript);
      
      // Verify transcript was added with an ID and timestamp
      expect(addedTranscript.id).toBeDefined();
      expect(addedTranscript.timestamp).toBeDefined();
      expect(addedTranscript.sessionId).toBe(testTranscript.sessionId);
      expect(addedTranscript.language).toBe(testTranscript.language);
      expect(addedTranscript.text).toBe(testTranscript.text);
      
      // Get transcripts by session
      const transcripts = await memStorage.getTranscriptsBySession(
        testTranscript.sessionId,
        testTranscript.language
      );
      
      // Verify the transcript is included in the results
      expect(transcripts).toContainEqual(addedTranscript);
    });
    
    it('should handle multiple transcripts for the same session', async () => {
      // Add multiple transcripts for the same session
      const transcripts: Transcript[] = [];
      
      for (let i = 0; i < 5; i++) {
        const transcript = await memStorage.addTranscript({
          ...testTranscript,
          text: `Transcript ${i}`
        });
        transcripts.push(transcript);
        
        // Add a small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // Get transcripts by session
      const retrievedTranscripts = await memStorage.getTranscriptsBySession(
        testTranscript.sessionId,
        testTranscript.language
      );
      
      // Verify all transcripts are included
      expect(retrievedTranscripts.length).toBe(transcripts.length);
      
      // Verify transcripts are in ascending timestamp order
      for (let i = 0; i < retrievedTranscripts.length - 1; i++) {
        expect(retrievedTranscripts[i].timestamp.getTime())
          .toBeLessThanOrEqual(retrievedTranscripts[i + 1].timestamp.getTime());
      }
    });
    
    it('should filter transcripts by session ID and language', async () => {
      // Add transcripts with different session IDs and languages
      await memStorage.addTranscript(testTranscript);
      
      await memStorage.addTranscript({
        ...testTranscript,
        sessionId: 'different-session'
      });
      
      await memStorage.addTranscript({
        ...testTranscript,
        language: 'fr'
      });
      
      // Get transcripts for the original session and language
      const transcripts = await memStorage.getTranscriptsBySession(
        testTranscript.sessionId,
        testTranscript.language
      );
      
      // Verify only matching transcripts are returned
      expect(transcripts.length).toBe(1);
      expect(transcripts[0].sessionId).toBe(testTranscript.sessionId);
      expect(transcripts[0].language).toBe(testTranscript.language);
    });
  });
  
  describe('Default languages', () => {
    it('should initialize with default languages', async () => {
      // Get all languages
      const languages = await memStorage.getLanguages();
      
      // Verify default languages exist
      expect(languages.length).toBeGreaterThan(0);
      
      // Check for expected default languages
      const languageCodes = languages.map(lang => lang.code);
      expect(languageCodes).toContain('en-US');
      expect(languageCodes).toContain('es');
      expect(languageCodes).toContain('de');
      expect(languageCodes).toContain('fr');
    });
    
    it('should mark all default languages as active', async () => {
      // Get active languages
      const activeLanguages = await memStorage.getActiveLanguages();
      
      // Verify all default languages are active
      expect(activeLanguages.length).toBeGreaterThan(0);
      
      // Check they're all marked as active
      activeLanguages.forEach(lang => {
        expect(lang.isActive).toBe(true);
      });
    });
  });
});