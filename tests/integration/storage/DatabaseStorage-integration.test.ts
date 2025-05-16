/**
 * Integration Tests for DatabaseStorage
 * 
 * These tests verify that DatabaseStorage correctly interacts with a real PostgreSQL database.
 * This requires an actual database connection and will modify the test database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseStorage } from '../../../server/storage';
import { 
  initTestDatabase, 
  closeDatabaseConnection, 
  addTestTranslation, 
  addTestTranscript 
} from '../../setup/db-setup';
import { 
  type InsertUser, 
  type InsertLanguage,
  type InsertTranslation,
  type InsertTranscript
} from '../../../shared/schema';

// Skip these tests if DATABASE_URL is not set
const runDatabaseTests = !!process.env.DATABASE_URL;

// Mark the whole describe block as conditional
(runDatabaseTests ? describe : describe.skip)('DatabaseStorage Integration Tests', () => {
  let dbStorage: DatabaseStorage;
  
  // Setup: initialize database before all tests
  beforeAll(async () => {
    // Initialize test database with clean state
    await initTestDatabase();
    
    // Create storage instance to test
    dbStorage = new DatabaseStorage();
  });
  
  // Cleanup: close connection after all tests
  afterAll(async () => {
    await closeDatabaseConnection();
  });
  
  describe('User operations', () => {
    it('should create and retrieve a user', async () => {
      // Create a user
      const testUser: InsertUser = {
        username: 'integrationtestuser',
        password: 'testpassword123'
      };
      
      // Add user to database
      const createdUser = await dbStorage.createUser(testUser);
      
      // Verify the user has an ID
      expect(createdUser.id).toBeDefined();
      expect(createdUser.username).toBe(testUser.username);
      
      // Retrieve the user by ID
      const retrievedUser = await dbStorage.getUser(createdUser.id);
      
      // Verify retrieved user matches created user
      expect(retrievedUser).toEqual(createdUser);
      
      // Retrieve by username
      const retrievedByUsername = await dbStorage.getUserByUsername(testUser.username);
      
      // Verify retrieved user matches created user
      expect(retrievedByUsername).toEqual(createdUser);
    });
  });
  
  describe('Language operations', () => {
    it('should retrieve default languages', async () => {
      // Get all languages
      const languages = await dbStorage.getLanguages();
      
      // Verify default languages exist
      expect(languages.length).toBeGreaterThan(0);
      
      // Check for expected defaults
      const languageCodes = languages.map(lang => lang.code);
      expect(languageCodes).toContain('en-US');
      expect(languageCodes).toContain('es');
      expect(languageCodes).toContain('fr');
      expect(languageCodes).toContain('de');
    });
    
    it('should create a new language', async () => {
      // Create new language
      const testLanguage: InsertLanguage = {
        code: 'it',
        name: 'Italian',
        isActive: true
      };
      
      // Add to database
      const createdLanguage = await dbStorage.createLanguage(testLanguage);
      
      // Verify created with ID
      expect(createdLanguage.id).toBeDefined();
      expect(createdLanguage.code).toBe(testLanguage.code);
      
      // Retrieve by code
      const retrievedLanguage = await dbStorage.getLanguageByCode(testLanguage.code);
      
      // Verify it's the same
      expect(retrievedLanguage).toEqual(createdLanguage);
    });
    
    it('should update language status', async () => {
      // Get a language to update
      const language = await dbStorage.getLanguageByCode('en-US');
      expect(language).toBeDefined();
      
      // Current status should be active
      expect(language!.isActive).toBe(true);
      
      // Update to inactive
      const updatedLanguage = await dbStorage.updateLanguageStatus('en-US', false);
      
      // Verify updated
      expect(updatedLanguage).toBeDefined();
      expect(updatedLanguage!.isActive).toBe(false);
      
      // Get active languages and verify en-US is not among them
      const activeLanguages = await dbStorage.getActiveLanguages();
      const activeCodes = activeLanguages.map(lang => lang.code);
      expect(activeCodes).not.toContain('en-US');
      
      // Reset back to active for other tests
      await dbStorage.updateLanguageStatus('en-US', true);
    });
  });
  
  describe('Translation operations', () => {
    it('should add and retrieve translations', async () => {
      // Create test translation
      const testTranslation: InsertTranslation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es',
        originalText: 'Integration test translation',
        translatedText: 'Traducción de prueba de integración',
        latency: 320
      };
      
      // Add to database
      const addedTranslation = await dbStorage.addTranslation(testTranslation);
      
      // Verify added with ID and timestamp
      expect(addedTranslation.id).toBeDefined();
      expect(addedTranslation.timestamp).toBeDefined();
      expect(addedTranslation.originalText).toBe(testTranslation.originalText);
      
      // Get translations by language
      const translations = await dbStorage.getTranslationsByLanguage('es', 10);
      
      // Verify includes our translation
      const found = translations.some(t => 
        t.id === addedTranslation.id && 
        t.originalText === testTranslation.originalText
      );
      expect(found).toBe(true);
    });
    
    it('should respect the limit parameter', async () => {
      // Add multiple translations
      await Promise.all([
        dbStorage.addTranslation({
          sourceLanguage: 'en-US',
          targetLanguage: 'fr',
          originalText: 'Test 1',
          translatedText: 'Test 1 en français',
          latency: 100
        }),
        dbStorage.addTranslation({
          sourceLanguage: 'en-US',
          targetLanguage: 'fr',
          originalText: 'Test 2',
          translatedText: 'Test 2 en français',
          latency: 110
        }),
        dbStorage.addTranslation({
          sourceLanguage: 'en-US',
          targetLanguage: 'fr',
          originalText: 'Test 3',
          translatedText: 'Test 3 en français',
          latency: 120
        })
      ]);
      
      // Get with limit=2
      const limitedTranslations = await dbStorage.getTranslationsByLanguage('fr', 2);
      
      // Verify limit was applied
      expect(limitedTranslations.length).toBe(2);
    });
  });
  
  describe('Transcript operations', () => {
    it('should add and retrieve transcripts', async () => {
      // Create test transcript
      const testTranscript: InsertTranscript = {
        sessionId: 'integration-test-session',
        language: 'en-US',
        text: 'Integration test transcript text'
      };
      
      // Add to database
      const addedTranscript = await dbStorage.addTranscript(testTranscript);
      
      // Verify added with ID and timestamp
      expect(addedTranscript.id).toBeDefined();
      expect(addedTranscript.timestamp).toBeDefined();
      expect(addedTranscript.text).toBe(testTranscript.text);
      
      // Get transcripts by session and language
      const transcripts = await dbStorage.getTranscriptsBySession(
        testTranscript.sessionId,
        testTranscript.language
      );
      
      // Verify includes our transcript
      expect(transcripts.length).toBeGreaterThan(0);
      const found = transcripts.some(t => 
        t.id === addedTranscript.id && 
        t.text === testTranscript.text
      );
      expect(found).toBe(true);
    });
    
    it('should filter transcripts by session and language', async () => {
      // Add transcripts with different session IDs
      await Promise.all([
        dbStorage.addTranscript({
          sessionId: 'filter-test-session-1',
          language: 'en-US',
          text: 'Session 1 Transcript 1'
        }),
        dbStorage.addTranscript({
          sessionId: 'filter-test-session-1',
          language: 'en-US',
          text: 'Session 1 Transcript 2'
        }),
        dbStorage.addTranscript({
          sessionId: 'filter-test-session-2',
          language: 'en-US',
          text: 'Session 2 Transcript'
        }),
        dbStorage.addTranscript({
          sessionId: 'filter-test-session-1',
          language: 'fr',
          text: 'Session 1 French Transcript'
        })
      ]);
      
      // Get transcripts for session 1, en-US
      const transcripts = await dbStorage.getTranscriptsBySession(
        'filter-test-session-1',
        'en-US'
      );
      
      // Verify correct filter applied
      expect(transcripts.length).toBe(2);
      expect(transcripts.every(t => t.sessionId === 'filter-test-session-1')).toBe(true);
      expect(transcripts.every(t => t.language === 'en-US')).toBe(true);
    });
  });
});