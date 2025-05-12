/**
 * Storage Module Unit Tests
 * 
 * This file tests the storage interface functionality with proper testing techniques
 * as per the testing strategy guidelines.
 */

import { IStorage } from '../../../server/storage';
import { User, Language, Translation, Transcript } from '../../../shared/schema';

// Create a mock implementation of the IStorage interface for testing
class MockStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private languages: Map<number, Language> = new Map();
  private translations: Map<number, Translation> = new Map();
  private transcripts: Map<number, Transcript> = new Map();
  
  private userId = 1;
  private languageId = 1;
  private translationId = 1;
  private transcriptId = 1;
  
  constructor() {
    // Initialize with some test data
    this.users.set(1, { 
      id: 1, 
      username: 'testuser', 
      password: 'hashed_password'
      // Note: removed role property as it doesn't exist in User type
    });
    
    this.languages.set(1, {
      id: 1,
      name: 'English',
      code: 'en-US',
      isActive: true
    });
    
    this.languages.set(2, {
      id: 2,
      name: 'Spanish',
      code: 'es-ES',
      isActive: true
    });
  }
  
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }
  
  async createUser(user: any): Promise<User> {
    const id = this.userId++;
    const newUser = { ...user, id };
    this.users.set(id, newUser as User);
    return newUser as User;
  }
  
  async getLanguages(): Promise<Language[]> {
    return Array.from(this.languages.values());
  }
  
  async getActiveLanguages(): Promise<Language[]> {
    return Array.from(this.languages.values())
      .filter(lang => lang.isActive);
  }
  
  async getLanguageByCode(code: string): Promise<Language | undefined> {
    for (const lang of this.languages.values()) {
      if (lang.code === code) {
        return lang;
      }
    }
    return undefined;
  }
  
  async createLanguage(language: any): Promise<Language> {
    const id = this.languageId++;
    const newLanguage = { ...language, id };
    this.languages.set(id, newLanguage as Language);
    return newLanguage as Language;
  }
  
  async updateLanguageStatus(code: string, isActive: boolean): Promise<Language | undefined> {
    const language = await this.getLanguageByCode(code);
    if (language) {
      const updatedLanguage = { ...language, isActive };
      this.languages.set(language.id, updatedLanguage);
      return updatedLanguage;
    }
    return undefined;
  }
  
  async addTranslation(translation: any): Promise<Translation> {
    const id = this.translationId++;
    const timestamp = new Date();
    const newTranslation = { ...translation, id, timestamp };
    this.translations.set(id, newTranslation as Translation);
    return newTranslation as Translation;
  }
  
  async getTranslationsByLanguage(targetLanguage: string, limit = 10): Promise<Translation[]> {
    return Array.from(this.translations.values())
      .filter(t => t.targetLanguage === targetLanguage)
      .sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return b.timestamp.getTime() - a.timestamp.getTime();
        }
        return 0;
      })
      .slice(0, limit);
  }
  
  async addTranscript(transcript: any): Promise<Transcript> {
    const id = this.transcriptId++;
    const timestamp = new Date();
    const newTranscript = { ...transcript, id, timestamp };
    this.transcripts.set(id, newTranscript as Transcript);
    return newTranscript as Transcript;
  }
  
  async getTranscriptsBySession(sessionId: string, language: string): Promise<Transcript[]> {
    return Array.from(this.transcripts.values())
      .filter(t => t.sessionId === sessionId && t.language === language)
      .sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return a.timestamp.getTime() - b.timestamp.getTime();
        }
        return 0;
      });
  }
}

describe('Storage Interface', () => {
  let storage: IStorage;
  
  beforeEach(() => {
    // Create a fresh storage instance for each test
    storage = new MockStorage();
  });
  
  it('should retrieve a user by ID', async () => {
    const user = await storage.getUser(1);
    expect(user).toBeDefined();
    expect(user?.username).toBe('testuser');
  });
  
  it('should retrieve a user by username', async () => {
    const user = await storage.getUserByUsername('testuser');
    expect(user).toBeDefined();
    expect(user?.id).toBe(1);
  });
  
  it('should create a new user', async () => {
    const newUser = await storage.createUser({
      username: 'newuser',
      password: 'hashed_new_password'
    });
    
    expect(newUser).toBeDefined();
    expect(newUser.id).toBeGreaterThan(0); // Should have a valid ID
    expect(newUser.username).toBe('newuser');
    
    // Verify we can retrieve the created user
    const retrievedUser = await storage.getUser(newUser.id);
    expect(retrievedUser).toEqual(newUser);
  });
  
  it('should get all languages', async () => {
    const languages = await storage.getLanguages();
    expect(languages).toHaveLength(2);
    expect(languages[0].name).toBe('English');
    expect(languages[1].name).toBe('Spanish');
  });
  
  it('should get only active languages', async () => {
    // First deactivate Spanish
    await storage.updateLanguageStatus('es-ES', false);
    
    const activeLanguages = await storage.getActiveLanguages();
    expect(activeLanguages).toHaveLength(1);
    expect(activeLanguages[0].code).toBe('en-US');
  });
  
  it('should get a language by code', async () => {
    const language = await storage.getLanguageByCode('es-ES');
    expect(language).toBeDefined();
    expect(language?.name).toBe('Spanish');
  });
  
  it('should create a new language', async () => {
    const newLanguage = await storage.createLanguage({
      name: 'French',
      code: 'fr-FR',
      isActive: true
    });
    
    expect(newLanguage).toBeDefined();
    expect(newLanguage.id).toBeGreaterThan(0); // Should have a valid ID
    expect(newLanguage.name).toBe('French');
    
    // Verify we can retrieve the created language
    const languages = await storage.getLanguages();
    const foundLanguage = languages.find(lang => lang.code === 'fr-FR');
    expect(foundLanguage).toBeDefined();
    expect(foundLanguage?.name).toBe('French');
  });
  
  it('should add a translation', async () => {
    const translation = await storage.addTranslation({
      sourceLanguage: 'en-US',
      targetLanguage: 'es-ES',
      originalText: 'Hello world',
      translatedText: 'Hola mundo',
      latency: 150
    });
    
    expect(translation).toBeDefined();
    expect(translation.id).toBe(1);
    expect(translation.originalText).toBe('Hello world');
    expect(translation.translatedText).toBe('Hola mundo');
    expect(translation.timestamp).toBeInstanceOf(Date);
  });
  
  it('should get translations by language', async () => {
    // Add a few translations
    await storage.addTranslation({
      sourceLanguage: 'en-US',
      targetLanguage: 'es-ES',
      originalText: 'Hello',
      translatedText: 'Hola',
    });
    
    await storage.addTranslation({
      sourceLanguage: 'en-US',
      targetLanguage: 'fr-FR',
      originalText: 'Hello',
      translatedText: 'Bonjour',
    });
    
    await storage.addTranslation({
      sourceLanguage: 'en-US',
      targetLanguage: 'es-ES',
      originalText: 'Goodbye',
      translatedText: 'Adiós',
    });
    
    // Get Spanish translations
    const spanishTranslations = await storage.getTranslationsByLanguage('es-ES');
    expect(spanishTranslations).toHaveLength(2);
    
    // Get French translations
    const frenchTranslations = await storage.getTranslationsByLanguage('fr-FR');
    expect(frenchTranslations).toHaveLength(1);
    expect(frenchTranslations[0].translatedText).toBe('Bonjour');
  });
  
  it('should add a transcript', async () => {
    const transcript = await storage.addTranscript({
      sessionId: 'session-123',
      language: 'en-US',
      text: 'This is a test transcript'
    });
    
    expect(transcript).toBeDefined();
    expect(transcript.id).toBe(1);
    expect(transcript.sessionId).toBe('session-123');
    expect(transcript.text).toBe('This is a test transcript');
    expect(transcript.timestamp).toBeInstanceOf(Date);
  });
  
  it('should get transcripts by session and language', async () => {
    // Add a few transcripts
    await storage.addTranscript({
      sessionId: 'session-123',
      language: 'en-US',
      text: 'First message'
    });
    
    await storage.addTranscript({
      sessionId: 'session-123',
      language: 'en-US',
      text: 'Second message'
    });
    
    await storage.addTranscript({
      sessionId: 'session-456',
      language: 'en-US',
      text: 'Other session message'
    });
    
    // Get transcripts for session-123
    const transcripts = await storage.getTranscriptsBySession('session-123', 'en-US');
    expect(transcripts).toHaveLength(2);
    expect(transcripts[0].text).toBe('First message');
    expect(transcripts[1].text).toBe('Second message');
    
    // Get transcripts for session-456
    const otherTranscripts = await storage.getTranscriptsBySession('session-456', 'en-US');
    expect(otherTranscripts).toHaveLength(1);
    expect(otherTranscripts[0].text).toBe('Other session message');
  });
});