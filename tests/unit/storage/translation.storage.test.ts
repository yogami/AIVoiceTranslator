import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemTranslationStorage, DbTranslationStorage } from '../../../server/storage/translation.storage';
import { StorageError } from '../../../server/storage.error';
import { type Translation, type InsertTranslation } from '../../../shared/schema';

// Mock the db module
vi.mock('../../../server/db', () => {
  const actualDbModule = vi.importActual('../../../server/db');
  // Create a more robust mock for the db instance and its chainable methods
  const mockThen = vi.fn(); // For making mockDbInstance thenable for select queries

  const mockDbInstance = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    offset: vi.fn(),
    // Make the instance itself thenable for select queries
    then: mockThen,
    // Add any other properties or methods of db that are accessed, e.g., if it's a Drizzle instance
    dynamic: false // Example: if db has a 'dynamic' property
  };

  // Setup chainable methods to return the instance itself
  mockDbInstance.select.mockReturnValue(mockDbInstance);
  mockDbInstance.from.mockReturnValue(mockDbInstance);
  mockDbInstance.where.mockReturnValue(mockDbInstance);
  mockDbInstance.orderBy.mockReturnValue(mockDbInstance);
  mockDbInstance.limit.mockReturnValue(mockDbInstance);
  mockDbInstance.insert.mockReturnValue(mockDbInstance);
  mockDbInstance.values.mockReturnValue(mockDbInstance);
  mockDbInstance.offset.mockReturnValue(mockDbInstance);
  // `returning` is a finalizer for inserts/updates.
  // `then` is a finalizer for selects.

  return {
    ...actualDbModule, // Spread actual exports
    db: mockDbInstance, // Override db with our mock
    // If you use sql template tags directly in translation.storage.ts, mock it here too
    // sql: vi.fn().mockImplementation((strings, ...values) => ({ /* ... */ }))
  };
});

// Import the mocked db *after* vi.mock has been defined
import { db as mockedDb } from '../../../server/db';

const DEFAULT_TRANSLATION_QUERY_LIMIT = 10; // As defined in translation.storage.ts

describe('Translation Storage', () => {
  beforeEach(() => {
    const mocksToReset = [
      mockedDb.select, mockedDb.from, mockedDb.where, mockedDb.orderBy, mockedDb.limit,
      mockedDb.insert, mockedDb.values, mockedDb.returning, mockedDb.offset,
      (mockedDb as any).then
    ];
    mocksToReset.forEach(mockFn => {
      if (mockFn && typeof (mockFn as any).mockReset === 'function') {
        (mockFn as any).mockReset(); // Use mockReset to clear implementations and history
      }
    });

    // Re-establish default behaviors for chainable methods
    (mockedDb.select as any).mockReturnValue(mockedDb);
    (mockedDb.from as any).mockReturnValue(mockedDb);
    (mockedDb.where as any).mockReturnValue(mockedDb);
    (mockedDb.orderBy as any).mockReturnValue(mockedDb);
    (mockedDb.limit as any).mockReturnValue(mockedDb);
    (mockedDb.insert as any).mockReturnValue(mockedDb);
    (mockedDb.values as any).mockReturnValue(mockedDb);
    (mockedDb.offset as any).mockReturnValue(mockedDb);
    // mockedDb.returning is configured per test (for inserts)
    // (mockedDb as any).then is configured per test (for selects)
  });

  describe('MemTranslationStorage', () => {
    let translationStorage: MemTranslationStorage;
    let translationsMap: Map<number, Translation>;
    let idCounter: { value: number };

    beforeEach(() => {
      translationsMap = new Map<number, Translation>();
      idCounter = { value: 1 };
      // Corrected constructor: Removed the third argument
      translationStorage = new MemTranslationStorage(translationsMap, idCounter);
    });

    it('should create a translation', async () => {
      const newTrans: InsertTranslation = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello',
        translatedText: 'Hola',
        sessionId: 'session-abc',
      };
      const createdTrans = await translationStorage.createTranslation(newTrans);
      expect(createdTrans.originalText).toBe(newTrans.originalText);
      expect(createdTrans.id).toBe(1);
      expect(translationsMap.get(1)).toEqual(createdTrans);
      expect(idCounter.value).toBe(2);
      expect(createdTrans.timestamp).toBeInstanceOf(Date);
      expect(createdTrans.sessionId).toBe('session-abc');
    });

    it('should add a translation (alias for create)', async () => {
      const newTrans: InsertTranslation = { sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'Goodbye', translatedText: 'Au revoir', sessionId: 'session-def' };
      const addedTrans = await translationStorage.addTranslation(newTrans);
      expect(addedTrans.id).toBe(1);
      expect(translationsMap.has(1)).toBe(true);
      expect(addedTrans.sessionId).toBe('session-def');
    });

    it('should retrieve a translation by ID', async () => {
      const newTrans: InsertTranslation = { sourceLanguage: 'de', targetLanguage: 'it', originalText: 'Danke', translatedText: 'Grazie', sessionId: 'session-ghi' };
      const createdTrans = await translationStorage.createTranslation(newTrans);
      const retrievedTrans = await translationStorage.getTranslation(createdTrans.id);
      expect(retrievedTrans).toEqual(createdTrans);
    });

    it('should return undefined for a non-existent translation ID', async () => {
      expect(await translationStorage.getTranslation(999)).toBeUndefined();
    });

    it('should retrieve translations by target language with limit', async () => {
      await translationStorage.createTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Yes', translatedText: 'Si', sessionId: 's1' });
      await translationStorage.createTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'No', translatedText: 'No', sessionId: 's1' });
      await translationStorage.createTranslation({ sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'Maybe', translatedText: 'Peut-être', sessionId: 's2' });
      
      const esTranslations = await translationStorage.getTranslationsByLanguage('es', 1);
      expect(esTranslations.length).toBe(1);
      expect(esTranslations[0].targetLanguage).toBe('es');

      const allEsTranslations = await translationStorage.getTranslationsByLanguage('es', 5);
      expect(allEsTranslations.length).toBe(2);
    });

    it('should retrieve all translations with default limit, sorted by timestamp desc', async () => {
      const t1 = await translationStorage.createTranslation({ sourceLanguage: 'en', targetLanguage: 'es', originalText: 'T1', translatedText: 'T1_es', sessionId: 'sA' });
      await new Promise(resolve => setTimeout(resolve, 10)); // ensure different timestamps
      const t2 = await translationStorage.createTranslation({ sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'T2', translatedText: 'T2_fr', sessionId: 'sB' });
      
      const translations = await translationStorage.getTranslations(2);
      expect(translations.length).toBe(2);
      expect(translations[0].id).toBe(t2.id); // t2 should be first (most recent)
      expect(translations[1].id).toBe(t1.id);
    });

    it('should retrieve translations by date range', async () => {
      const date1 = new Date('2023-01-01T10:00:00Z');
      const date2 = new Date('2023-01-01T12:00:00Z');
      const date3 = new Date('2023-01-01T14:00:00Z');

      translationsMap.set(1, { id: 1, sessionId: 'range-s1', sourceLanguage: 'en', targetLanguage: 'es', originalText: 'A', translatedText: 'A_es', timestamp: date1, latency: 50 });
      translationsMap.set(2, { id: 2, sessionId: 'range-s1', sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'B', translatedText: 'B_fr', timestamp: date2, latency: 50 });
      translationsMap.set(3, { id: 3, sessionId: 'range-s2', sourceLanguage: 'de', targetLanguage: 'it', originalText: 'C', translatedText: 'C_it', timestamp: date3, latency: 50 });
      idCounter.value = 4;

      const rangeStart = new Date('2023-01-01T09:00:00Z');
      const rangeMid = new Date('2023-01-01T13:00:00Z');
      // const rangeEnd = new Date('2023-01-01T15:00:00Z'); // Not used in this specific test logic

      const result = await translationStorage.getTranslationsByDateRange(rangeStart, rangeMid);
      expect(result.length).toBe(2);
      expect(result.find(t => t.id === 1)).toBeDefined();
      expect(result.find(t => t.id === 2)).toBeDefined();
      expect(result.find(t => t.id === 3)).toBeUndefined();
    });

    it('should correctly initialize idCounter if translationsMap is pre-populated', () => {
      translationsMap.set(1, { id: 1, sessionId: 's1', sourceLanguage: 'en', targetLanguage: 'es', originalText: 'P1', translatedText: 'P1_es', timestamp: new Date(), latency: 0 });
      translationsMap.set(7, { id: 7, sessionId: 's2', sourceLanguage: 'fr', targetLanguage: 'de', originalText: 'P7', translatedText: 'P7_de', timestamp: new Date(), latency: 0 });
      idCounter = { value: 1 };
      // Corrected constructor
      const prePopulatedStorage = new MemTranslationStorage(translationsMap, idCounter);
      expect(idCounter.value).toBe(8); // maxId + 1
    });
  });

  describe('DbTranslationStorage', () => {
    let dbTranslationStorage: DbTranslationStorage;

    beforeEach(() => {
      dbTranslationStorage = new DbTranslationStorage();
      // Reset the .then mock before each test that might use it
      ((mockedDb as any).then as any).mockReset();
    });

    it('should retrieve a translation by ID from DB', async () => {
      const mockTrans: Translation = { id: 1, sessionId: 'db-s1', sourceLanguage: 'en', targetLanguage: 'es', originalText: 'DB', translatedText: 'DB_es', timestamp: new Date(), latency: 50 };
      // For SELECT queries, mock the .then() method
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve([mockTrans]));
      const trans = await dbTranslationStorage.getTranslation(1);
      expect(trans).toEqual(mockTrans);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(expect.anything()); // translations table
      expect(mockedDb.where).toHaveBeenCalledWith(expect.anything()); // eq(translations.id, 1)
      expect(mockedDb.limit).toHaveBeenCalledWith(1);
      // .returning() is not typically used for SELECTs in this pattern
    });

    it('should create a translation in DB', async () => {
      const newTrans: InsertTranslation = { sourceLanguage: 'en', targetLanguage: 'de', originalText: 'DB New', translatedText: 'DB Neu', sessionId: 'db-s-create' };
      const returnedTrans: Translation = { id: 2, ...newTrans, timestamp: new Date(), latency: null, sessionId: newTrans.sessionId ?? null };
      (mockedDb.returning as any).mockResolvedValueOnce([returnedTrans]);
      const createdTrans = await dbTranslationStorage.createTranslation(newTrans);
      expect(createdTrans).toEqual(returnedTrans);
      expect(mockedDb.insert).toHaveBeenCalledWith(expect.anything()); // translations table
      expect(mockedDb.values).toHaveBeenCalledWith(newTrans);
      expect(mockedDb.returning).toHaveBeenCalled();
    });

    it('should add a translation in DB (alias for create)', async () => {
      const newTrans: InsertTranslation = { sourceLanguage: 'en', targetLanguage: 'it', originalText: 'DB Add', translatedText: 'DB Aggiungi', sessionId: 'db-s-add' };
      const returnedTrans: Translation = { id: 3, ...newTrans, timestamp: new Date(), latency: null, sessionId: newTrans.sessionId ?? null };
      (mockedDb.returning as any).mockResolvedValueOnce([returnedTrans]);
      await dbTranslationStorage.addTranslation(newTrans);
      expect(mockedDb.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.values).toHaveBeenCalledWith(newTrans);
      expect(mockedDb.returning).toHaveBeenCalled();
    });

    it('should retrieve translations by target language from DB', async () => {
      const mockTranslations: Translation[] = [
        { id: 1, sessionId: 'db-s-lang', sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Hola', translatedText: 'Hello', timestamp: new Date(), latency: 100 }
      ];
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve(mockTranslations));
      const translations = await dbTranslationStorage.getTranslationsByLanguage('es', 5);
      expect(translations).toEqual(mockTranslations);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.where).toHaveBeenCalledWith(expect.anything()); // eq(translations.targetLanguage, 'es')
      expect(mockedDb.orderBy).toHaveBeenCalledWith(expect.anything()); // desc(translations.timestamp)
      expect(mockedDb.limit).toHaveBeenCalledWith(5);
      // .returning() is not typically used for SELECTs
    });

    it('should retrieve all translations from DB with default limit', async () => {
      const mockTranslations: Translation[] = [
        { id: 1, sessionId: 'db-s-all', sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Any', translatedText: 'Cualquiera', timestamp: new Date(), latency: 100 }
      ];
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve(mockTranslations));
      const translations = await dbTranslationStorage.getTranslations(); 
      expect(translations).toEqual(mockTranslations);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.orderBy).toHaveBeenCalledWith(expect.anything()); // desc(translations.timestamp)
      expect(mockedDb.limit).toHaveBeenCalledWith(DEFAULT_TRANSLATION_QUERY_LIMIT);
      // .returning() is not typically used for SELECTs
    });

    it('should retrieve translations by date range from DB', async () => {
      const mockTranslations: Translation[] = [
        { id: 1, sessionId: 'db-s-date', sourceLanguage: 'en', targetLanguage: 'es', originalText: 'DateRange', translatedText: 'RangoDeFechas', timestamp: new Date(), latency: 100 }
      ];
      const startDate = new Date('2023-01-01T00:00:00Z');
      const endDate = new Date('2023-01-31T23:59:59Z');
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve(mockTranslations));
      const translations = await dbTranslationStorage.getTranslationsByDateRange(startDate, endDate);
      expect(translations).toEqual(mockTranslations);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.where).toHaveBeenCalledWith(expect.anything()); // and(gte(...), lte(...))
      expect(mockedDb.orderBy).toHaveBeenCalledWith(expect.anything()); // desc(translations.timestamp)
      // .returning() is not typically used for SELECTs
    });

    it('should throw StorageError if DB returns no data after insert', async () => {
      const newTrans: InsertTranslation = { sourceLanguage: 'en', targetLanguage: 'es', originalText: 'DB Fail', translatedText: 'DB_Fail_es', sessionId: 'db-session-fail' };
      (mockedDb.returning as any).mockResolvedValueOnce([]);
      await expect(dbTranslationStorage.addTranslation(newTrans)).rejects.toThrow(StorageError);
      (mockedDb.returning as any).mockResolvedValueOnce([]); // For the second assertion
      await expect(dbTranslationStorage.addTranslation(newTrans)).rejects.toSatisfy((e: StorageError) => e.code === 'DB_INSERT_FAILED');
    });

    it('should throw StorageError on generic DB error during addTranslation', async () => {
      const newTrans: InsertTranslation = { sourceLanguage: 'en', targetLanguage: 'es', originalText: 'DB Error', translatedText: 'DB_Error_es', sessionId: 'db-session-error' };
      (mockedDb.returning as any).mockRejectedValueOnce(new Error('Some DB error'));
      await expect(dbTranslationStorage.addTranslation(newTrans)).rejects.toThrow(StorageError);
      (mockedDb.returning as any).mockRejectedValueOnce(new Error('Some DB error')); // For the second assertion
      await expect(dbTranslationStorage.addTranslation(newTrans)).rejects.toSatisfy((e: StorageError) => e.code === 'DB_ERROR');
    });

    it('should throw StorageError with DUPLICATE_ENTRY for unique constraint violation in DB for addTranslation', async () => {
      const newTrans: InsertTranslation = { sourceLanguage: 'en', targetLanguage: 'es', originalText: 'DB Duplicate', translatedText: 'DB_Duplicate_es', sessionId: 'db-session-duplicate' };
      // Simulate a Drizzle/Postgres-like error for unique constraint violation
      const dbError = new Error('duplicate key value violates unique constraint "translations_originalText_targetLanguage_sessionId_unique"');
      (dbError as any).code = '23505'; // Standard PostgreSQL error code for unique_violation
      
      (mockedDb.returning as any).mockRejectedValueOnce(dbError);
      await expect(dbTranslationStorage.addTranslation(newTrans)).rejects.toThrow(StorageError);
      
      // Reset mock for the second assertion if needed, or ensure the first one covers the code check
      (mockedDb.returning as any).mockRejectedValueOnce(dbError);
      await expect(dbTranslationStorage.addTranslation(newTrans)).rejects.toSatisfy((e: StorageError) => {
        return e.code === 'DUPLICATE_ENTRY';
      });
    });

    it('should retrieve all translations from DB (paginated)', async () => {
      const mockTranslationsPage1: Translation[] = Array.from({ length: DEFAULT_TRANSLATION_QUERY_LIMIT }, (_, i) => ({
        id: i + 1, sessionId: `s-page1-${i}`, sourceLanguage: 'en', targetLanguage: 'es', originalText: `Page1-${i}`, translatedText: `P1-${i}_es`, timestamp: new Date(Date.now() - i * 1000), latency: 50
      }));
      const mockTranslationsPage2: Translation[] = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1 + DEFAULT_TRANSLATION_QUERY_LIMIT, sessionId: `s-page2-${i}`, sourceLanguage: 'en', targetLanguage: 'es', originalText: `Page2-${i}`, translatedText: `P2-${i}_es`, timestamp: new Date(Date.now() - (i + DEFAULT_TRANSLATION_QUERY_LIMIT) * 1000), latency: 50
      }));

      // Mock for first page
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve(mockTranslationsPage1));
      const translationsPage1 = await dbTranslationStorage.getTranslations(DEFAULT_TRANSLATION_QUERY_LIMIT, 0);
      expect(translationsPage1.length).toBe(DEFAULT_TRANSLATION_QUERY_LIMIT);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.orderBy).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.limit).toHaveBeenCalledWith(DEFAULT_TRANSLATION_QUERY_LIMIT);
      expect(mockedDb.offset).toHaveBeenCalledWith(0); // Check offset for the first page

      // Mock for second page
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve(mockTranslationsPage2));
      // Corrected the call to getTranslations to pass the page number as the second argument (offset)
      const translationsPage2 = await dbTranslationStorage.getTranslations(DEFAULT_TRANSLATION_QUERY_LIMIT, DEFAULT_TRANSLATION_QUERY_LIMIT);
      expect(translationsPage2.length).toBe(5);
      // Ensure offset is called with the correct value for the second page
      expect(mockedDb.offset).toHaveBeenCalledWith(DEFAULT_TRANSLATION_QUERY_LIMIT); 
    });

    // Test for getTranslationsBySessionId
  });
});
