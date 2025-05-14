/**
 * Tests for MemStorage class
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemStorage } from '../../server/storage';
import type { 
  User, Language, Translation, Transcript,
  InsertUser, InsertLanguage, InsertTranslation, InsertTranscript
} from '../../shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;
  
  beforeEach(() => {
    storage = new MemStorage();
  });
  
  describe('User methods', () => {
    it('should get a user by ID', async () => {
      // Create a test user
      const insertUser: InsertUser = { 
        username: 'testuser', 
        password: 'password123' 
      };
      
      const createdUser = await storage.createUser(insertUser);
      
      // Get the user by ID
      const user = await storage.getUser(createdUser.id);
      
      // Verify the user is returned correctly
      expect(user).toEqual(createdUser);
    });
    
    it('should return undefined when user ID is not found', async () => {
      // Try to get a non-existent user
      const user = await storage.getUser(999);
      
      // Verify null is returned
      expect(user).toBeUndefined();
    });
    
    it('should get a user by username', async () => {
      // Create a test user
      const insertUser: InsertUser = { 
        username: 'testuser', 
        password: 'password123' 
      };
      
      const createdUser = await storage.createUser(insertUser);
      
      // Get the user by username
      const user = await storage.getUserByUsername('testuser');
      
      // Verify the user is returned correctly
      expect(user).toEqual(createdUser);
    });
    
    it('should return undefined when username is not found', async () => {
      // Try to get a non-existent user
      const user = await storage.getUserByUsername('nonexistent');
      
      // Verify null is returned
      expect(user).toBeUndefined();
    });
    
    it('should create a new user', async () => {
      // Create user data
      const insertUser: InsertUser = { 
        username: 'newuser', 
        password: 'password123' 
      };
      
      // Create the user
      const user = await storage.createUser(insertUser);
      
      // Verify the user is created with an ID
      expect(user).toMatchObject(insertUser);
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('number');
    });
  });
  
  describe('Language methods', () => {
    it('should get all languages', async () => {
      // Get all languages (should include defaults from constructor)
      const languages = await storage.getLanguages();
      
      // Verify languages are returned
      expect(languages.length).toBeGreaterThan(0);
      expect(languages[0]).toHaveProperty('code');
      expect(languages[0]).toHaveProperty('name');
      expect(languages[0]).toHaveProperty('isActive');
    });
    
    it('should get active languages', async () => {
      // Create an inactive language
      await storage.createLanguage({
        code: 'inactive',
        name: 'Inactive Language',
        isActive: false
      });
      
      // Get active languages
      const languages = await storage.getActiveLanguages();
      
      // Verify only active languages are returned
      expect(languages.length).toBeGreaterThan(0);
      languages.forEach(lang => {
        expect(lang.isActive).toBe(true);
      });
      
      // Verify the inactive language is not included
      const inactiveLanguage = languages.find(lang => lang.code === 'inactive');
      expect(inactiveLanguage).toBeUndefined();
    });
    
    it('should get a language by code', async () => {
      // Create a test language
      const insertLanguage: InsertLanguage = { 
        code: 'test', 
        name: 'Test Language',
        isActive: true
      };
      
      const createdLanguage = await storage.createLanguage(insertLanguage);
      
      // Get the language by code
      const language = await storage.getLanguageByCode('test');
      
      // Verify the language is returned correctly
      expect(language).toEqual(createdLanguage);
    });
    
    it('should return undefined when language code is not found', async () => {
      // Try to get a non-existent language
      const language = await storage.getLanguageByCode('nonexistent');
      
      // Verify null is returned
      expect(language).toBeUndefined();
    });
    
    it('should create a new language', async () => {
      // Create language data
      const insertLanguage: InsertLanguage = { 
        code: 'new', 
        name: 'New Language',
        isActive: true
      };
      
      // Create the language
      const language = await storage.createLanguage(insertLanguage);
      
      // Verify the language is created with an ID
      expect(language).toMatchObject(insertLanguage);
      expect(language.id).toBeDefined();
      expect(typeof language.id).toBe('number');
    });
    
    it('should update language status', async () => {
      // Create a test language
      const insertLanguage: InsertLanguage = { 
        code: 'update', 
        name: 'Update Test',
        isActive: true
      };
      
      await storage.createLanguage(insertLanguage);
      
      // Update the language status
      const updatedLanguage = await storage.updateLanguageStatus('update', false);
      
      // Verify the language status is updated
      expect(updatedLanguage).toBeDefined();
      expect(updatedLanguage!.isActive).toBe(false);
      
      // Verify the change persisted
      const language = await storage.getLanguageByCode('update');
      expect(language!.isActive).toBe(false);
    });
    
    it('should return undefined when updating a non-existent language', async () => {
      // Try to update a non-existent language
      const result = await storage.updateLanguageStatus('nonexistent', false);
      
      // Verify undefined is returned
      expect(result).toBeUndefined();
    });
  });
  
  describe('Translation methods', () => {
    it('should add a translation', async () => {
      // Create translation data
      const insertTranslation: InsertTranslation = { 
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello',
        translatedText: 'Hola',
        latency: 1200
      };
      
      // Add the translation
      const translation = await storage.addTranslation(insertTranslation);
      
      // Verify the translation is added with ID and timestamp
      expect(translation).toMatchObject(insertTranslation);
      expect(translation.id).toBeDefined();
      expect(translation.timestamp).toBeDefined();
      expect(translation.timestamp instanceof Date).toBe(true);
    });
    
    it('should get translations by language with default limit', async () => {
      // Add multiple translations
      for (let i = 0; i < 15; i++) {
        await storage.addTranslation({
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          originalText: `Text ${i}`,
          translatedText: `Texte ${i}`,
          latency: 1000 + i
        });
      }
      
      // Get translations for a specific language (default limit is 10)
      const translations = await storage.getTranslationsByLanguage('fr');
      
      // Verify only 10 translations are returned
      expect(translations.length).toBe(10);
      
      // Verify they're sorted by timestamp (newest first)
      for (let i = 0; i < translations.length - 1; i++) {
        expect(translations[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          translations[i + 1].timestamp.getTime()
        );
      }
    });
    
    it('should get translations by language with custom limit', async () => {
      // Add multiple translations
      for (let i = 0; i < 15; i++) {
        await storage.addTranslation({
          sourceLanguage: 'en',
          targetLanguage: 'de',
          originalText: `Text ${i}`,
          translatedText: `Text ${i}`,
          latency: 1000 + i
        });
      }
      
      // Get translations with a custom limit
      const translations = await storage.getTranslationsByLanguage('de', 5);
      
      // Verify only 5 translations are returned
      expect(translations.length).toBe(5);
    });
    
    it('should return empty array for non-existent language', async () => {
      // Get translations for a language with no entries
      const translations = await storage.getTranslationsByLanguage('nonexistent');
      
      // Verify an empty array is returned
      expect(translations).toEqual([]);
    });
  });
  
  describe('Transcript methods', () => {
    it('should add a transcript', async () => {
      // Create transcript data
      const insertTranscript: InsertTranscript = { 
        sessionId: 'session123',
        language: 'en',
        text: 'Hello world'
      };
      
      // Add the transcript
      const transcript = await storage.addTranscript(insertTranscript);
      
      // Verify the transcript is added with ID and timestamp
      expect(transcript).toMatchObject(insertTranscript);
      expect(transcript.id).toBeDefined();
      expect(transcript.timestamp).toBeDefined();
      expect(transcript.timestamp instanceof Date).toBe(true);
    });
    
    it('should get transcripts by session and language', async () => {
      // Add transcripts for multiple sessions and languages
      await storage.addTranscript({
        sessionId: 'session-test',
        language: 'en',
        text: 'Transcript 1'
      });
      
      await storage.addTranscript({
        sessionId: 'session-test',
        language: 'en',
        text: 'Transcript 2'
      });
      
      await storage.addTranscript({
        sessionId: 'session-test',
        language: 'fr',
        text: 'Transcript FR'
      });
      
      // Get transcripts for a specific session and language
      const transcripts = await storage.getTranscriptsBySession('session-test', 'en');
      
      // Verify only the matching transcripts are returned
      expect(transcripts.length).toBe(2);
      transcripts.forEach(transcript => {
        expect(transcript.sessionId).toBe('session-test');
        expect(transcript.language).toBe('en');
      });
      
      // Verify they're sorted by timestamp (oldest first)
      for (let i = 0; i < transcripts.length - 1; i++) {
        expect(transcripts[i].timestamp.getTime()).toBeLessThanOrEqual(
          transcripts[i + 1].timestamp.getTime()
        );
      }
    });
    
    it('should return empty array when no matching transcripts', async () => {
      // Get transcripts for a non-existent session
      const transcripts = await storage.getTranscriptsBySession('nonexistent', 'en');
      
      // Verify an empty array is returned
      expect(transcripts).toEqual([]);
    });
  });
});