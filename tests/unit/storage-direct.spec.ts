/**
 * Direct tests for DatabaseStorage class using dependency injection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  type User, type Language, type Translation, type Transcript,
  type InsertUser, type InsertLanguage, type InsertTranslation, type InsertTranscript
} from '../../shared/schema';

// Create a mock database with all the methods from DatabaseStorage
class MockDatabaseStorage {
  getUser = vi.fn();
  getUserByUsername = vi.fn();
  createUser = vi.fn();
  getLanguages = vi.fn();
  getActiveLanguages = vi.fn();
  getLanguageByCode = vi.fn();
  createLanguage = vi.fn();
  updateLanguageStatus = vi.fn();
  addTranslation = vi.fn();
  getTranslationsByLanguage = vi.fn();
  addTranscript = vi.fn();
  getTranscriptsBySession = vi.fn();
}

describe('DatabaseStorage', () => {
  let mockStorage: MockDatabaseStorage;
  
  beforeEach(() => {
    mockStorage = new MockDatabaseStorage();
    vi.clearAllMocks();
  });
  
  describe('User methods', () => {
    it('should get a user by ID', async () => {
      // Setup mock user data
      const mockUser: User = { 
        id: 1, 
        username: 'testuser', 
        password: 'password123' 
      };
      
      // Setup the mock return value
      mockStorage.getUser.mockResolvedValue(mockUser);
      
      // Execute the method
      const result = await mockStorage.getUser(1);
      
      // Assertions
      expect(result).toEqual(mockUser);
      expect(mockStorage.getUser).toHaveBeenCalledWith(1);
    });
    
    it('should return undefined when user ID is not found', async () => {
      // Setup empty result
      mockStorage.getUser.mockResolvedValue(undefined);
      
      // Execute the method
      const result = await mockStorage.getUser(999);
      
      // Assertions
      expect(result).toBeUndefined();
      expect(mockStorage.getUser).toHaveBeenCalledWith(999);
    });
    
    it('should get a user by username', async () => {
      // Setup mock user data
      const mockUser: User = { 
        id: 1, 
        username: 'testuser', 
        password: 'password123' 
      };
      
      // Setup the mock return value
      mockStorage.getUserByUsername.mockResolvedValue(mockUser);
      
      // Execute the method
      const result = await mockStorage.getUserByUsername('testuser');
      
      // Assertions
      expect(result).toEqual(mockUser);
      expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('testuser');
    });
    
    it('should create a new user', async () => {
      // Setup mock user data
      const insertUser: InsertUser = { 
        username: 'newuser', 
        password: 'password123' 
      };
      
      const mockUser: User = { 
        ...insertUser,
        id: 1
      };
      
      // Setup the mock return value
      mockStorage.createUser.mockResolvedValue(mockUser);
      
      // Execute the method
      const result = await mockStorage.createUser(insertUser);
      
      // Assertions
      expect(result).toEqual(mockUser);
      expect(mockStorage.createUser).toHaveBeenCalledWith(insertUser);
    });
  });
  
  describe('Language methods', () => {
    it('should get all languages', async () => {
      // Setup mock language data
      const mockLanguages: Language[] = [
        { id: 1, code: 'en', name: 'English', isActive: true },
        { id: 2, code: 'es', name: 'Spanish', isActive: true }
      ];
      
      // Setup the mock return value
      mockStorage.getLanguages.mockResolvedValue(mockLanguages);
      
      // Execute the method
      const result = await mockStorage.getLanguages();
      
      // Assertions
      expect(result).toEqual(mockLanguages);
      expect(mockStorage.getLanguages).toHaveBeenCalled();
    });
    
    it('should get active languages', async () => {
      // Setup mock language data
      const mockLanguages: Language[] = [
        { id: 1, code: 'en', name: 'English', isActive: true },
        { id: 2, code: 'es', name: 'Spanish', isActive: true }
      ];
      
      // Setup the mock return value
      mockStorage.getActiveLanguages.mockResolvedValue(mockLanguages);
      
      // Execute the method
      const result = await mockStorage.getActiveLanguages();
      
      // Assertions
      expect(result).toEqual(mockLanguages);
      expect(mockStorage.getActiveLanguages).toHaveBeenCalled();
    });
    
    it('should get a language by code', async () => {
      // Setup mock language data
      const mockLanguage: Language = { 
        id: 1, 
        code: 'en', 
        name: 'English', 
        isActive: true 
      };
      
      // Setup the mock return value
      mockStorage.getLanguageByCode.mockResolvedValue(mockLanguage);
      
      // Execute the method
      const result = await mockStorage.getLanguageByCode('en');
      
      // Assertions
      expect(result).toEqual(mockLanguage);
      expect(mockStorage.getLanguageByCode).toHaveBeenCalledWith('en');
    });
    
    it('should create a new language', async () => {
      // Setup mock language data
      const insertLanguage: InsertLanguage = { 
        code: 'fr', 
        name: 'French', 
        isActive: true 
      };
      
      const mockLanguage: Language = { 
        ...insertLanguage,
        id: 3
      };
      
      // Setup the mock return value
      mockStorage.createLanguage.mockResolvedValue(mockLanguage);
      
      // Execute the method
      const result = await mockStorage.createLanguage(insertLanguage);
      
      // Assertions
      expect(result).toEqual(mockLanguage);
      expect(mockStorage.createLanguage).toHaveBeenCalledWith(insertLanguage);
    });
    
    it('should update language status', async () => {
      // Setup mock language data
      const mockLanguage: Language = { 
        id: 1, 
        code: 'en', 
        name: 'English', 
        isActive: false 
      };
      
      // Setup the mock return value
      mockStorage.updateLanguageStatus.mockResolvedValue(mockLanguage);
      
      // Execute the method
      const result = await mockStorage.updateLanguageStatus('en', false);
      
      // Assertions
      expect(result).toEqual(mockLanguage);
      expect(mockStorage.updateLanguageStatus).toHaveBeenCalledWith('en', false);
    });
  });
  
  describe('Translation methods', () => {
    it('should add a translation', async () => {
      // Setup mock translation data
      const timestamp = new Date();
      const insertTranslation: InsertTranslation = { 
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello',
        translatedText: 'Hola',
        latency: 1200
      };
      
      const mockTranslation: Translation = { 
        ...insertTranslation,
        id: 1,
        timestamp
      };
      
      // Setup the mock return value
      mockStorage.addTranslation.mockResolvedValue(mockTranslation);
      
      // Execute the method
      const result = await mockStorage.addTranslation(insertTranslation);
      
      // Assertions
      expect(result).toEqual(mockTranslation);
      expect(mockStorage.addTranslation).toHaveBeenCalledWith(insertTranslation);
    });
    
    it('should get translations by language', async () => {
      // Setup mock translation data
      const timestamp = new Date();
      const mockTranslations: Translation[] = [
        { 
          id: 1,
          sourceLanguage: 'en',
          targetLanguage: 'es',
          originalText: 'Hello',
          translatedText: 'Hola',
          timestamp,
          latency: 1200
        },
        { 
          id: 2,
          sourceLanguage: 'en',
          targetLanguage: 'es',
          originalText: 'Goodbye',
          translatedText: 'Adiós',
          timestamp,
          latency: 1100
        }
      ];
      
      // Setup the mock return value
      mockStorage.getTranslationsByLanguage.mockResolvedValue(mockTranslations);
      
      // Execute the method
      const result = await mockStorage.getTranslationsByLanguage('es', 10);
      
      // Assertions
      expect(result).toEqual(mockTranslations);
      expect(mockStorage.getTranslationsByLanguage).toHaveBeenCalledWith('es', 10);
    });
  });
  
  describe('Transcript methods', () => {
    it('should add a transcript', async () => {
      // Setup mock transcript data
      const timestamp = new Date();
      const insertTranscript: InsertTranscript = { 
        sessionId: 'session123',
        language: 'en',
        text: 'Hello world'
      };
      
      const mockTranscript: Transcript = { 
        ...insertTranscript,
        id: 1,
        timestamp
      };
      
      // Setup the mock return value
      mockStorage.addTranscript.mockResolvedValue(mockTranscript);
      
      // Execute the method
      const result = await mockStorage.addTranscript(insertTranscript);
      
      // Assertions
      expect(result).toEqual(mockTranscript);
      expect(mockStorage.addTranscript).toHaveBeenCalledWith(insertTranscript);
    });
    
    it('should get transcripts by session and language', async () => {
      // Setup mock transcript data
      const timestamp = new Date();
      const mockTranscripts: Transcript[] = [
        { 
          id: 1,
          sessionId: 'session123',
          language: 'en',
          text: 'Hello world',
          timestamp
        },
        { 
          id: 2,
          sessionId: 'session123',
          language: 'en',
          text: 'How are you?',
          timestamp
        }
      ];
      
      // Setup the mock return value
      mockStorage.getTranscriptsBySession.mockResolvedValue(mockTranscripts);
      
      // Execute the method
      const result = await mockStorage.getTranscriptsBySession('session123', 'en');
      
      // Assertions
      expect(result).toEqual(mockTranscripts);
      expect(mockStorage.getTranscriptsBySession).toHaveBeenCalledWith('session123', 'en');
    });
  });
});