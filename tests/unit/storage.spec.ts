/**
 * Storage Tests (Consolidated)
 * 
 * A comprehensive test suite for both MemStorage and DatabaseStorage implementations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IStorage, MemStorage, DatabaseStorage } from '../../server/storage';
import { languages, users, translations, transcripts } from '../../shared/schema';
import { db } from '../../server/db';
import { eq } from 'drizzle-orm';

// Mock the database
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([]))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([]))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([]))
      }))
    })),
    transaction: vi.fn((callback) => callback(db))
  }
}));

describe('Storage Services', () => {
  describe('MemStorage', () => {
    let storage: IStorage;

    beforeEach(() => {
      storage = new MemStorage();
    });

    it('should initialize with default languages', async () => {
      // Act
      const result = await storage.getLanguages();
      
      // Assert
      expect(result.length).toBeGreaterThan(0);
      
      // Verify it contains expected languages
      const english = result.find(lang => lang.code === 'en-US');
      const spanish = result.find(lang => lang.code === 'es-ES');
      
      expect(english).toBeDefined();
      expect(spanish).toBeDefined();
      
      if (english) expect(english.name).toBe('English');
      if (spanish) expect(spanish.name).toBe('Spanish');
    });

    it('should create and retrieve a user', async () => {
      // Arrange
      const testUser = {
        username: 'testuser',
        password: 'password123'
      };
      
      // Act
      const createdUser = await storage.createUser(testUser);
      const retrievedUser = await storage.getUserByUsername('testuser');
      
      // Assert
      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBeDefined();
      expect(createdUser.username).toBe(testUser.username);
      
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.id).toBe(createdUser.id);
      expect(retrievedUser?.username).toBe(testUser.username);
    });

    it('should manage language status', async () => {
      // Arrange - Get a language to update
      const initialLanguages = await storage.getLanguages();
      const testCode = initialLanguages[0].code;
      
      // Act - Update the language status
      const updatedLanguage = await storage.updateLanguageStatus(testCode, false);
      const activeLanguages = await storage.getActiveLanguages();
      
      // Assert
      expect(updatedLanguage).toBeDefined();
      expect(updatedLanguage?.isActive).toBe(false);
      
      // The updated language should not be in active languages
      const foundInActive = activeLanguages.some(lang => lang.code === testCode);
      expect(foundInActive).toBe(false);
    });

    it('should store and retrieve translations', async () => {
      // Arrange
      const testTranslation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 250
      };
      
      // Act
      const savedTranslation = await storage.addTranslation(testTranslation);
      const retrievedTranslations = await storage.getTranslationsByLanguage('es-ES', 10);
      
      // Assert
      expect(savedTranslation).toBeDefined();
      expect(savedTranslation.id).toBeDefined();
      expect(retrievedTranslations.length).toBeGreaterThan(0);
      
      const found = retrievedTranslations.find(t => t.id === savedTranslation.id);
      expect(found).toBeDefined();
      expect(found?.originalText).toBe('Hello world');
      expect(found?.translatedText).toBe('Hola mundo');
    });

    it('should store and retrieve transcripts by session', async () => {
      // Arrange
      const sessionId = 'test-session-1';
      const language = 'en-US';
      const testTranscript = {
        sessionId,
        language,
        text: 'This is a test transcript'
      };
      
      // Act
      const savedTranscript = await storage.addTranscript(testTranscript);
      const retrievedTranscripts = await storage.getTranscriptsBySession(sessionId, language);
      
      // Assert
      expect(savedTranscript).toBeDefined();
      expect(savedTranscript.id).toBeDefined();
      expect(retrievedTranscripts.length).toBe(1);
      expect(retrievedTranscripts[0].text).toBe('This is a test transcript');
    });
  });

  describe('DatabaseStorage', () => {
    let storage: IStorage;
    let dbMock;

    beforeEach(() => {
      storage = new DatabaseStorage();
      dbMock = db;
      vi.clearAllMocks();
      
      // Setup common mocked responses
      (dbMock.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });
      
      (dbMock.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, isActive: true }])
        })
      });
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should get a user by ID', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'testuser', password: 'hashedpwd' };
      (dbMock.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser])
        })
      });
      
      // Act
      const result = await storage.getUser(1);
      
      // Assert
      expect(result).toEqual(mockUser);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.select().from).toHaveBeenCalledWith(users);
    });

    it('should get a user by username', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'testuser', password: 'hashedpwd' };
      (dbMock.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser])
        })
      });
      
      // Act
      const result = await storage.getUserByUsername('testuser');
      
      // Assert
      expect(result).toEqual(mockUser);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.select().from).toHaveBeenCalledWith(users);
    });

    it('should create a user', async () => {
      // Arrange
      const newUser = { username: 'newuser', password: 'newpwd' };
      const mockCreatedUser = { id: 1, ...newUser };
      
      (dbMock.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreatedUser])
        })
      });
      
      // Act
      const result = await storage.createUser(newUser);
      
      // Assert
      expect(result).toEqual(mockCreatedUser);
      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.insert().values).toHaveBeenCalledWith(newUser);
    });

    it('should get all languages', async () => {
      // Arrange
      const mockLanguages = [
        { id: 1, code: 'en-US', name: 'English', isActive: true },
        { id: 2, code: 'es-ES', name: 'Spanish', isActive: false }
      ];
      
      (dbMock.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockLanguages)
      });
      
      // Act
      const result = await storage.getLanguages();
      
      // Assert
      expect(result).toEqual(mockLanguages);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.select().from).toHaveBeenCalledWith(languages);
    });

    it('should get active languages only', async () => {
      // Arrange
      const mockLanguages = [
        { id: 1, code: 'en-US', name: 'English', isActive: true }
      ];
      
      (dbMock.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockLanguages)
        })
      });
      
      // Act
      const result = await storage.getActiveLanguages();
      
      // Assert
      expect(result).toEqual(mockLanguages);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.select().from).toHaveBeenCalledWith(languages);
    });

    it('should add and retrieve translations', async () => {
      // Arrange
      const newTranslation = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello',
        translatedText: 'Hola',
        latency: 100
      };
      
      const mockCreatedTranslation = { 
        id: 1, 
        ...newTranslation, 
        timestamp: new Date() 
      };
      
      (dbMock.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreatedTranslation])
        })
      });
      
      // Act
      const created = await storage.addTranslation(newTranslation);
      
      // Assert for adding
      expect(created).toEqual(mockCreatedTranslation);
      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.insert().values).toHaveBeenCalledWith(newTranslation);
      
      // Setup for retrieval
      const mockRetrievedTranslations = [mockCreatedTranslation];
      (dbMock.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockRetrievedTranslations)
          })
        })
      });
      
      // Act for retrieval
      const retrieved = await storage.getTranslationsByLanguage('es-ES', 5);
      
      // Assert for retrieval
      expect(retrieved).toEqual(mockRetrievedTranslations);
      expect(dbMock.select).toHaveBeenCalled();
    });
  });
});