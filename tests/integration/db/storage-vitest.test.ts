/**
 * Database Integration Tests
 * 
 * This file tests the integration between the storage interface and the database.
 * Note: We're using a mocked DB in this example instead of a real PostgreSQL instance.
 * 
 * Converted from Jest to Vitest
 */

import { IStorage, MemStorage } from '../../../server/storage';
import { User, Language, Translation, Transcript } from '../../../shared/schema';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('Storage Integration', () => {
  let storage: IStorage;
  
  beforeAll(async () => {
    // Use the MemStorage implementation for tests
    // In a real production test, this would connect to a test database
    storage = new MemStorage();
  });
  
  beforeEach(async () => {
    // Reset storage state or perform setup as needed
    // This would typically involve cleaning up test data in a real DB
  });
  
  it('should save and retrieve a user', async () => {
    // Create a test user
    const user = await storage.createUser({
      username: 'testuser',
      password: 'password123'
    });
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    
    // Retrieve the user
    const retrievedUser = await storage.getUser(user.id);
    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.username).toBe('testuser');
  });
  
  it('should retrieve a user by username', async () => {
    // Create a test user if not exists
    await storage.createUser({
      username: 'findme',
      password: 'password456'
    });
    
    // Find by username
    const user = await storage.getUserByUsername('findme');
    expect(user).toBeDefined();
    expect(user?.username).toBe('findme');
  });
  
  it('should save and retrieve languages', async () => {
    // Create a test language
    const language = await storage.createLanguage({
      name: 'Test Language',
      code: 'test-lang',
      isActive: true
    });
    
    expect(language).toBeDefined();
    expect(language.code).toBe('test-lang');
    
    // Get all languages
    const languages = await storage.getLanguages();
    expect(languages.some(lang => lang.code === 'test-lang')).toBeTruthy();
    
    // Get language by code
    const retrievedLang = await storage.getLanguageByCode('test-lang');
    expect(retrievedLang).toBeDefined();
    expect(retrievedLang?.name).toBe('Test Language');
  });
  
  it('should update language status', async () => {
    // Create an active language
    const language = await storage.createLanguage({
      name: 'Status Test',
      code: 'status-test',
      isActive: true
    });
    
    // Verify it's active
    expect(language.isActive).toBeTruthy();
    
    // Update status to inactive
    const updated = await storage.updateLanguageStatus('status-test', false);
    expect(updated).toBeDefined();
    expect(updated?.isActive).toBeFalsy();
    
    // Get active languages and verify it's not included
    const activeLanguages = await storage.getActiveLanguages();
    expect(activeLanguages.some(lang => lang.code === 'status-test')).toBeFalsy();
  });
  
  it('should save and retrieve translations', async () => {
    // Create a test translation
    const translation = await storage.addTranslation({
      sourceLanguage: 'en-US',
      targetLanguage: 'test-lang',
      originalText: 'Hello world',
      translatedText: 'Hello in test language',
      latency: 100
    });
    
    expect(translation).toBeDefined();
    expect(translation.originalText).toBe('Hello world');
    
    // Get translations by language
    const translations = await storage.getTranslationsByLanguage('test-lang');
    expect(translations.length).toBeGreaterThan(0);
    expect(translations[0].translatedText).toBe('Hello in test language');
  });
  
  it('should save and retrieve transcripts', async () => {
    // Create a test transcript
    const transcript = await storage.addTranscript({
      sessionId: 'test-session',
      language: 'en-US',
      text: 'Test transcript text'
    });
    
    expect(transcript).toBeDefined();
    expect(transcript.text).toBe('Test transcript text');
    
    // Get transcripts by session
    const transcripts = await storage.getTranscriptsBySession('test-session', 'en-US');
    expect(transcripts.length).toBeGreaterThan(0);
    expect(transcripts[0].text).toBe('Test transcript text');
  });
});