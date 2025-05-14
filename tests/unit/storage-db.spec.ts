/**
 * Tests for DatabaseStorage class
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database connection
vi.mock('../../server/db', () => {
  const mockSelect = vi.fn();
  const mockWhere = vi.fn();
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockOrderBy = vi.fn();
  const mockLimit = vi.fn();
  const mockReturning = vi.fn();
  const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ returning: mockReturning })) }));
  const mockUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: mockWhere, returning: mockReturning })) }));
  
  // Create mock db object with chainable methods
  const mockDb = {
    select: mockSelect.mockReturnValue({ from: mockFrom }),
    insert: mockInsert,
    update: mockUpdate,
    from: mockFrom,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    returning: mockReturning
  };
  
  // Add methods to the mocks to enable chaining
  mockWhere.mockReturnValue({ 
    orderBy: mockOrderBy.mockReturnValue({
      limit: mockLimit.mockReturnValue([])
    })
  });
  
  return {
    db: mockDb,
    pool: { 
      end: vi.fn(),
      connect: vi.fn()
    }
  };
});

// Import after mocking
import { DatabaseStorage } from '../../server/storage';
import { db } from '../../server/db';
import { 
  users, languages, translations, transcripts,
  type User, type Language, type Translation, type Transcript,
  type InsertUser, type InsertLanguage, type InsertTranslation, type InsertTranscript
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;
  
  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
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
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser])
        })
      } as any);
      
      // Execute the method
      const result = await storage.getUser(1);
      
      // Assertions
      expect(result).toEqual(mockUser);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(users);
      expect(db.select().from().where).toHaveBeenCalledWith(eq(users.id, 1));
    });
    
    it('should return undefined when user ID is not found', async () => {
      // Setup empty result
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      } as any);
      
      // Execute the method
      const result = await storage.getUser(999);
      
      // Assertions
      expect(result).toBeUndefined();
    });
    
    it('should get a user by username', async () => {
      // Setup mock user data
      const mockUser: User = { 
        id: 1, 
        username: 'testuser', 
        password: 'password123' 
      };
      
      // Setup the mock return value
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser])
        })
      } as any);
      
      // Execute the method
      const result = await storage.getUserByUsername('testuser');
      
      // Assertions
      expect(result).toEqual(mockUser);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(users);
      expect(db.select().from().where).toHaveBeenCalledWith(eq(users.username, 'testuser'));
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
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser])
        })
      } as any);
      
      // Execute the method
      const result = await storage.createUser(insertUser);
      
      // Assertions
      expect(result).toEqual(mockUser);
      expect(db.insert).toHaveBeenCalledWith(users);
      expect(db.insert(users).values).toHaveBeenCalledWith(insertUser);
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
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockResolvedValue(mockLanguages)
      } as any);
      
      // Execute the method
      const result = await storage.getLanguages();
      
      // Assertions
      expect(result).toEqual(mockLanguages);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(languages);
    });
    
    it('should get active languages', async () => {
      // Setup mock language data
      const mockLanguages: Language[] = [
        { id: 1, code: 'en', name: 'English', isActive: true },
        { id: 2, code: 'es', name: 'Spanish', isActive: true }
      ];
      
      // Setup the mock return value
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockLanguages)
        })
      } as any);
      
      // Execute the method
      const result = await storage.getActiveLanguages();
      
      // Assertions
      expect(result).toEqual(mockLanguages);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(languages);
      expect(db.select().from().where).toHaveBeenCalledWith(eq(languages.isActive, true));
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
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockLanguage])
        })
      } as any);
      
      // Execute the method
      const result = await storage.getLanguageByCode('en');
      
      // Assertions
      expect(result).toEqual(mockLanguage);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(languages);
      expect(db.select().from().where).toHaveBeenCalledWith(eq(languages.code, 'en'));
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
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockLanguage])
        })
      } as any);
      
      // Execute the method
      const result = await storage.createLanguage(insertLanguage);
      
      // Assertions
      expect(result).toEqual(mockLanguage);
      expect(db.insert).toHaveBeenCalledWith(languages);
      expect(db.insert(languages).values).toHaveBeenCalledWith(insertLanguage);
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
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockLanguage])
          })
        })
      } as any);
      
      // Execute the method
      const result = await storage.updateLanguageStatus('en', false);
      
      // Assertions
      expect(result).toEqual(mockLanguage);
      expect(db.update).toHaveBeenCalledWith(languages);
      expect(db.update(languages).set).toHaveBeenCalledWith({ isActive: false });
      expect(db.update(languages).set().where).toHaveBeenCalledWith(eq(languages.code, 'en'));
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
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockTranslation])
        })
      } as any);
      
      // Execute the method
      const result = await storage.addTranslation(insertTranslation);
      
      // Assertions
      expect(result).toEqual(mockTranslation);
      expect(db.insert).toHaveBeenCalledWith(translations);
      expect(db.insert(translations).values).toHaveBeenCalledWith(insertTranslation);
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
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockTranslations)
            })
          })
        })
      } as any);
      
      // Execute the method
      const result = await storage.getTranslationsByLanguage('es', 10);
      
      // Assertions
      expect(result).toEqual(mockTranslations);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(translations);
      expect(db.select().from().where).toHaveBeenCalledWith(eq(translations.targetLanguage, 'es'));
      expect(db.select().from().where().orderBy).toHaveBeenCalledWith(desc(translations.timestamp));
      expect(db.select().from().where().orderBy().limit).toHaveBeenCalledWith(10);
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
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockTranscript])
        })
      } as any);
      
      // Execute the method
      const result = await storage.addTranscript(insertTranscript);
      
      // Assertions
      expect(result).toEqual(mockTranscript);
      expect(db.insert).toHaveBeenCalledWith(transcripts);
      expect(db.insert(transcripts).values).toHaveBeenCalledWith(insertTranscript);
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
      vi.mocked(db.select).mockReturnValueOnce({ 
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockTranscripts)
          })
        })
      } as any);
      
      // Execute the method
      const result = await storage.getTranscriptsBySession('session123', 'en');
      
      // Assertions
      expect(result).toEqual(mockTranscripts);
      expect(db.select).toHaveBeenCalled();
      expect(db.select().from).toHaveBeenCalledWith(transcripts);
      expect(db.select().from().where).toHaveBeenCalledWith(
        and(
          eq(transcripts.sessionId, 'session123'),
          eq(transcripts.language, 'en')
        )
      );
    });
  });
});