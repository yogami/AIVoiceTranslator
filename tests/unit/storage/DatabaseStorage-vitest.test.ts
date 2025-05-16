/**
 * Database Storage Tests
 * 
 * Tests for the DatabaseStorage class that implements the IStorage interface.
 * These tests verify correct interaction with a PostgreSQL database via drizzle-orm.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  users, languages, translations, transcripts,
  type User, type Language, type Translation, type Transcript,
  type InsertUser, type InsertLanguage, type InsertTranslation, type InsertTranscript
} from '../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Mock the drizzle-orm functions
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    eq: vi.fn((...args) => args), // Return args to check they're correct
    and: vi.fn((...args) => args),
    desc: vi.fn((column) => ({ column, order: 'desc' }))
  };
});

// Create a mock db object with all the drizzle methods
const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  orderBy: vi.fn(() => mockDb),
  limit: vi.fn(() => mockDb),
  insert: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  returning: vi.fn(() => {
    // Mock default return values
    return [];
  }),
  update: vi.fn(() => mockDb),
  set: vi.fn(() => mockDb),
  execute: vi.fn(() => Promise.resolve())
};

// Mock the db.ts module
vi.mock('../../../server/db', () => ({
  db: mockDb,
  pool: {
    connect: vi.fn()
  }
}));

// Import the DatabaseStorage class
import { DatabaseStorage } from '../../../server/storage';

describe('DatabaseStorage', () => {
  let dbStorage: DatabaseStorage;

  // Sample data for testing
  const sampleUser: User = {
    id: 1,
    username: 'testuser',
    password: 'password123'
  };

  const sampleLanguage: Language = {
    id: 1,
    code: 'en-US',
    name: 'English (United States)',
    isActive: true
  };

  const sampleTranslation: Translation = {
    id: 1,
    sourceLanguage: 'en-US',
    targetLanguage: 'es',
    originalText: 'Hello world',
    translatedText: 'Hola mundo',
    timestamp: new Date(),
    latency: 500
  };

  const sampleTranscript: Transcript = {
    id: 1,
    sessionId: 'test-session-123',
    language: 'en-US',
    text: 'This is a test transcript',
    timestamp: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbStorage = new DatabaseStorage();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('User methods', () => {
    it('should get a user by ID', async () => {
      // Setup the mock to return a specific user
      mockDb.returning.mockReturnValueOnce([sampleUser]);
      
      // Call the method
      const result = await dbStorage.getUser(1);
      
      // Verify the correct SQL operations were performed
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(users);
      expect(mockDb.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(users.id, 1);
      
      // Verify the result
      expect(result).toEqual(sampleUser);
    });
    
    it('should handle undefined when user not found', async () => {
      // Setup the mock to return empty array (user not found)
      mockDb.returning.mockReturnValueOnce([]);
      
      // Call the method
      const result = await dbStorage.getUser(999);
      
      // Verify the result is undefined
      expect(result).toBeUndefined();
    });
    
    it('should get a user by username', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleUser]);
      
      // Call the method
      const result = await dbStorage.getUserByUsername('testuser');
      
      // Verify the query construction
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(users);
      expect(mockDb.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(users.username, 'testuser');
      
      // Verify the result
      expect(result).toEqual(sampleUser);
    });
    
    it('should create a new user', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleUser]);
      
      // Prepare insert data
      const insertData: InsertUser = {
        username: 'testuser',
        password: 'password123'
      };
      
      // Call the method
      const result = await dbStorage.createUser(insertData);
      
      // Verify the query construction
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(insertData);
      expect(mockDb.returning).toHaveBeenCalled();
      
      // Verify the result
      expect(result).toEqual(sampleUser);
    });
  });
  
  describe('Language methods', () => {
    it('should get all languages', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleLanguage]);
      
      // Call the method
      const result = await dbStorage.getLanguages();
      
      // Verify the query construction
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(languages);
      
      // Verify the result
      expect(result).toEqual([sampleLanguage]);
    });
    
    it('should get only active languages', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleLanguage]);
      
      // Call the method
      const result = await dbStorage.getActiveLanguages();
      
      // Verify the query construction
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(languages);
      expect(mockDb.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(languages.isActive, true);
      
      // Verify the result
      expect(result).toEqual([sampleLanguage]);
    });
    
    it('should get a language by code', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleLanguage]);
      
      // Call the method
      const result = await dbStorage.getLanguageByCode('en-US');
      
      // Verify the query construction
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(languages);
      expect(mockDb.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(languages.code, 'en-US');
      
      // Verify the result
      expect(result).toEqual(sampleLanguage);
    });
    
    it('should create a new language', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleLanguage]);
      
      // Prepare insert data
      const insertData: InsertLanguage = {
        code: 'en-US',
        name: 'English (United States)',
        isActive: true
      };
      
      // Call the method
      const result = await dbStorage.createLanguage(insertData);
      
      // Verify the query construction
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(insertData);
      expect(mockDb.returning).toHaveBeenCalled();
      
      // Verify the result
      expect(result).toEqual(sampleLanguage);
    });
    
    it('should update a language status', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([{...sampleLanguage, isActive: false}]);
      
      // Call the method
      const result = await dbStorage.updateLanguageStatus('en-US', false);
      
      // Verify the query construction
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ isActive: false });
      expect(mockDb.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(languages.code, 'en-US');
      
      // Verify the result
      expect(result).toEqual({...sampleLanguage, isActive: false});
    });
  });
  
  describe('Translation methods', () => {
    it('should add a new translation', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleTranslation]);
      
      // Prepare insert data
      const insertData: InsertTranslation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 500
      };
      
      // Call the method
      const result = await dbStorage.addTranslation(insertData);
      
      // Verify the query construction
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(insertData);
      expect(mockDb.returning).toHaveBeenCalled();
      
      // Verify the result
      expect(result).toEqual(sampleTranslation);
    });
    
    it('should get translations by target language', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleTranslation]);
      
      // Call the method
      const result = await dbStorage.getTranslationsByLanguage('es', 5);
      
      // Verify the query construction
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(translations);
      expect(mockDb.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(translations.targetLanguage, 'es');
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(desc).toHaveBeenCalledWith(translations.timestamp);
      expect(mockDb.limit).toHaveBeenCalledWith(5);
      
      // Verify the result
      expect(result).toEqual([sampleTranslation]);
    });
  });
  
  describe('Transcript methods', () => {
    it('should add a new transcript', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleTranscript]);
      
      // Prepare insert data
      const insertData: InsertTranscript = {
        sessionId: 'test-session-123',
        language: 'en-US',
        text: 'This is a test transcript'
      };
      
      // Call the method
      const result = await dbStorage.addTranscript(insertData);
      
      // Verify the query construction
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(insertData);
      expect(mockDb.returning).toHaveBeenCalled();
      
      // Verify the result
      expect(result).toEqual(sampleTranscript);
    });
    
    it('should get transcripts by session and language', async () => {
      // Setup the mock
      mockDb.returning.mockReturnValueOnce([sampleTranscript]);
      
      // Call the method
      const result = await dbStorage.getTranscriptsBySession('test-session-123', 'en-US');
      
      // Verify the query construction
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(transcripts);
      expect(mockDb.where).toHaveBeenCalled();
      expect(and).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(transcripts.sessionId, 'test-session-123');
      expect(eq).toHaveBeenCalledWith(transcripts.language, 'en-US');
      expect(mockDb.orderBy).toHaveBeenCalledWith(transcripts.timestamp);
      
      // Verify the result
      expect(result).toEqual([sampleTranscript]);
    });
  });
});