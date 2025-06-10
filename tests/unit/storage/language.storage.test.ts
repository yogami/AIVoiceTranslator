import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemLanguageStorage, DbLanguageStorage } from '../../../server/storage/language.storage';
import { StorageError } from '../../../server/storage.error';
import { type Language, type InsertLanguage } from '../../../shared/schema';

// Mock the db module
vi.mock('../../../server/db', () => {
  const actualDbModule = vi.importActual('../../../server/db');
  const mockThen = vi.fn(); // For making mockDbInstance thenable for select queries

  const mockDbInstance = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
    // Make the instance itself thenable for select queries
    then: mockThen,
    dynamic: false // Example property
  };

  // Setup chainable methods to return the instance itself
  mockDbInstance.select.mockReturnValue(mockDbInstance);
  mockDbInstance.from.mockReturnValue(mockDbInstance);
  mockDbInstance.where.mockReturnValue(mockDbInstance);
  mockDbInstance.limit.mockReturnValue(mockDbInstance);
  mockDbInstance.insert.mockReturnValue(mockDbInstance);
  mockDbInstance.values.mockReturnValue(mockDbInstance);
  mockDbInstance.update.mockReturnValue(mockDbInstance);
  mockDbInstance.set.mockReturnValue(mockDbInstance);
  // `returning` is a finalizer for inserts/updates.
  // `then` is a finalizer for selects.

  return {
    ...actualDbModule,
    db: mockDbInstance,
  };
});

// Import the mocked db *after* vi.mock has been defined
import { db as mockedDb } from '../../../server/db';

describe('Language Storage', () => {
  beforeEach(() => {
    const mocksToClearAndReset = [
      mockedDb.select, mockedDb.from, mockedDb.where, mockedDb.limit,
      mockedDb.insert, mockedDb.values, mockedDb.update, mockedDb.set,
      mockedDb.returning,
      (mockedDb as any).then // Add the then mock to reset
    ];
    mocksToClearAndReset.forEach(mockFn => {
      // Use mockReset to clear implementations and call history
      if (mockFn && typeof (mockFn as any).mockReset === 'function') {
        (mockFn as any).mockReset();
      }
    });

    // Reset default chained mock implementations
    (mockedDb.select as any).mockReturnThis();
    (mockedDb.from as any).mockReturnThis();
    (mockedDb.where as any).mockReturnThis();
    (mockedDb.limit as any).mockReturnThis();
    (mockedDb.insert as any).mockReturnThis();
    (mockedDb.values as any).mockReturnThis();
    (mockedDb.update as any).mockReturnThis();
    (mockedDb.set as any).mockReturnThis();
    // mockedDb.returning is configured per test
    // (mockedDb as any).then is configured per test
  });

  describe('MemLanguageStorage', () => {
    let languageStorage: MemLanguageStorage;
    let languagesMap: Map<number, Language>;
    let languagesByCodeMap: Map<string, Language>; 
    let idCounter: { value: number };

    beforeEach(() => {
      languagesMap = new Map<number, Language>();
      idCounter = { value: 1 };
      // languagesByCodeMap is internally managed by MemLanguageStorage constructor
      languageStorage = new MemLanguageStorage(languagesMap, idCounter);
    });

    it('should initialize with default languages', async () => {
      await languageStorage.initializeDefaultLanguages();
      const english = await languageStorage.getLanguageByCode('en-US');
      expect(english).toBeDefined();
      expect(english?.name).toBe('English (United States)');
      const spanish = await languageStorage.getLanguageByCode('es');
      expect(spanish).toBeDefined();
      expect(spanish?.name).toBe('Spanish');
      // Check if they are in the map
      expect(languagesMap.size).toBeGreaterThan(0);
    });

    it('should create a language', async () => {
      const newLang: InsertLanguage = { code: 'test-LG', name: 'Test Language', isActive: true };
      const createdLang = await languageStorage.createLanguage(newLang);
      expect(createdLang.code).toBe(newLang.code);
      expect(createdLang.name).toBe(newLang.name);
      expect(createdLang.isActive).toBe(true);
      expect(createdLang.id).toBe(1);
      expect(languagesMap.get(1)).toEqual(createdLang);
      expect(await languageStorage.getLanguageByCode('test-LG')).toEqual(createdLang);
      expect(idCounter.value).toBe(2);
    });

    it('should not create a language with a duplicate code', async () => {
      const lang1: InsertLanguage = { code: 'test-LG', name: 'Test Language 1' };
      await languageStorage.createLanguage(lang1);
      const lang2: InsertLanguage = { code: 'test-LG', name: 'Test Language 2' };
      await expect(languageStorage.createLanguage(lang2)).rejects.toThrow(StorageError);
      await expect(languageStorage.createLanguage(lang2)).rejects.toSatisfy((e: StorageError) => e.code === 'DUPLICATE_ENTRY');
    });

    it('should throw error if code or name is not provided for createLanguage', async () => {
      const noCode: InsertLanguage = { name: 'No Code Lang' } as InsertLanguage;
      const noName: InsertLanguage = { code: 'no-name' } as InsertLanguage;
      await expect(languageStorage.createLanguage(noCode)).rejects.toThrow(StorageError);
      await expect(languageStorage.createLanguage(noCode)).rejects.toSatisfy((e: StorageError) => e.code === 'VALIDATION_ERROR');
      await expect(languageStorage.createLanguage(noName)).rejects.toThrow(StorageError);
      await expect(languageStorage.createLanguage(noName)).rejects.toSatisfy((e: StorageError) => e.code === 'VALIDATION_ERROR');
    });

    it('should retrieve a language by ID', async () => {
      const newLang: InsertLanguage = { code: 'test-ID', name: 'Test ID Language' };
      const createdLang = await languageStorage.createLanguage(newLang);
      const retrievedLang = await languageStorage.getLanguage(createdLang.id);
      expect(retrievedLang).toEqual(createdLang);
    });

    it('should retrieve a language by code', async () => {
      const newLang: InsertLanguage = { code: 'test-CODE', name: 'Test Code Language' };
      const createdLang = await languageStorage.createLanguage(newLang);
      const retrievedLang = await languageStorage.getLanguageByCode(newLang.code);
      expect(retrievedLang).toEqual(createdLang);
    });

    it('should return undefined for a non-existent language ID or code', async () => {
      expect(await languageStorage.getLanguage(999)).toBeUndefined();
      expect(await languageStorage.getLanguageByCode('non-existent')).toBeUndefined();
    });

    it('should list all languages', async () => {
      await languageStorage.createLanguage({ code: 'l1', name: 'Lang1' });
      await languageStorage.createLanguage({ code: 'l2', name: 'Lang2' });
      const allLangs = await languageStorage.listLanguages();
      expect(allLangs.length).toBe(2);
    });

    it('should get all languages (alias for listLanguages)', async () => {
      await languageStorage.createLanguage({ code: 'l1', name: 'Lang1' });
      const allLangs = await languageStorage.getLanguages();
      expect(allLangs.length).toBe(1);
    });

    it('should get active languages', async () => {
      await languageStorage.createLanguage({ code: 'l1', name: 'Lang1', isActive: true });
      await languageStorage.createLanguage({ code: 'l2', name: 'Lang2', isActive: false });
      await languageStorage.createLanguage({ code: 'l3', name: 'Lang3', isActive: true });
      const activeLangs = await languageStorage.getActiveLanguages();
      expect(activeLangs.length).toBe(2);
      expect(activeLangs.every(lang => lang.isActive)).toBe(true);
    });

    it('should update language status', async () => {
      const lang = await languageStorage.createLanguage({ code: 'l-update', name: 'Lang Update', isActive: true });
      expect(lang.isActive).toBe(true);
      const updatedLang = await languageStorage.updateLanguageStatus('l-update', false);
      expect(updatedLang).toBeDefined();
      expect(updatedLang?.isActive).toBe(false);
      const retrievedLang = await languageStorage.getLanguageByCode('l-update');
      expect(retrievedLang?.isActive).toBe(false);
    });

    it('should return undefined when updating status for non-existent language', async () => {
      const result = await languageStorage.updateLanguageStatus('non-existent', false);
      expect(result).toBeUndefined();
    });

     it('should correctly initialize idCounter and languagesByCodeMap if languagesMap is pre-populated', async () => {
      languagesMap.set(1, { id: 1, code: 'pre1', name: 'Pre Lang 1', isActive: true });
      languagesMap.set(5, { id: 5, code: 'pre5', name: 'Pre Lang 5', isActive: false });
      idCounter = { value: 1 }; // Reset counter
      const prePopulatedStorage = new MemLanguageStorage(languagesMap, idCounter);
      expect(idCounter.value).toBe(6); // Should be maxId + 1
      await expect(prePopulatedStorage.getLanguageByCode('pre1')).resolves.toBeDefined();
      await expect(prePopulatedStorage.getLanguageByCode('pre5')).resolves.toBeDefined();
    });
  });

  describe('DbLanguageStorage', () => {
    let dbLanguageStorage: DbLanguageStorage;

    beforeEach(() => {
      dbLanguageStorage = new DbLanguageStorage();
      // Reset the .then mock before each test that might use it
      ((mockedDb as any).then as any).mockReset();
    });

    it('should retrieve a language by ID from DB', async () => {
      const mockLang: Language = { id: 1, code: 'en', name: 'English', isActive: true };
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve([mockLang]));
      const lang = await dbLanguageStorage.getLanguage(1);
      expect(lang).toEqual(mockLang);
      expect(mockedDb.limit).toHaveBeenCalledWith(1);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalled();
      expect(mockedDb.where).toHaveBeenCalled();
    });

    it('should retrieve a language by code from DB', async () => {
      const mockLang: Language = { id: 1, code: 'en', name: 'English', isActive: true };
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve([mockLang]));
      const lang = await dbLanguageStorage.getLanguageByCode('en');
      expect(lang).toEqual(mockLang);
      expect(mockedDb.limit).toHaveBeenCalledWith(1);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalled();
      expect(mockedDb.where).toHaveBeenCalled();
    });

    it('should create a language in DB', async () => {
      const newLang: InsertLanguage = { code: 'fr', name: 'French', isActive: true };
      const returnedLang: Language = { id: 2, ...newLang, isActive: newLang.isActive ?? null };
      (mockedDb.returning as any).mockResolvedValueOnce([returnedLang]);
      const createdLang = await dbLanguageStorage.createLanguage(newLang);
      expect(createdLang).toEqual(returnedLang);
      expect(mockedDb.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.values).toHaveBeenCalledWith(newLang);
      expect(mockedDb.returning).toHaveBeenCalled();
    });
    
    it('should throw StorageError if code or name is not provided for createLanguage in DB', async () => {
      const noCode: InsertLanguage = { name: 'No Code Lang' } as InsertLanguage;
      const noName: InsertLanguage = { code: 'no-name' } as InsertLanguage;
      await expect(dbLanguageStorage.createLanguage(noCode)).rejects.toThrow(StorageError);
      await expect(dbLanguageStorage.createLanguage(noCode)).rejects.toSatisfy((e: StorageError) => e.code === 'VALIDATION_ERROR');
      await expect(dbLanguageStorage.createLanguage(noName)).rejects.toThrow(StorageError);
      await expect(dbLanguageStorage.createLanguage(noName)).rejects.toSatisfy((e: StorageError) => e.code === 'VALIDATION_ERROR');
    });

    it('should list all languages from DB', async () => {
      const mockLangs: Language[] = [{ id: 1, code: 'en', name: 'English', isActive: true }];
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve(mockLangs));
      const langs = await dbLanguageStorage.listLanguages();
      expect(langs).toEqual(mockLangs);
      expect(mockedDb.select).toHaveBeenCalled();
      // expect(mockedDb.returning).toHaveBeenCalled(); // returning is not for selects
    });

    it('should get active languages from DB', async () => {
      const mockActiveLangs: Language[] = [{ id: 1, code: 'en', name: 'English', isActive: true }];
      ((mockedDb as any).then as any).mockImplementationOnce((resolve: any) => resolve(mockActiveLangs));
      const activeLangs = await dbLanguageStorage.getActiveLanguages();
      expect(activeLangs).toEqual(mockActiveLangs);
      expect(mockedDb.where).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.select).toHaveBeenCalled();
      // expect(mockedDb.returning).toHaveBeenCalled(); // returning is not for selects
    });

    it('should update language status in DB', async () => {
      const updatedLang: Language = { id: 1, code: 'en', name: 'English', isActive: false };
      (mockedDb.returning as any).mockResolvedValueOnce([updatedLang]);
      const result = await dbLanguageStorage.updateLanguageStatus('en', false);
      expect(result).toEqual(updatedLang);
      expect(mockedDb.update).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.set).toHaveBeenCalledWith({ isActive: false });
      expect(mockedDb.where).toHaveBeenCalledWith(expect.anything());
      expect(mockedDb.returning).toHaveBeenCalled();
    });
    
    it('should throw StorageError on DB error during createLanguage', async () => {
      const newLang: InsertLanguage = { code: 'error-lg', name: 'Error Lang' };
      (mockedDb.returning as any).mockRejectedValueOnce(new Error('DB insert error'));
      await expect(dbLanguageStorage.createLanguage(newLang)).rejects.toThrow(StorageError);
      (mockedDb.returning as any).mockRejectedValueOnce(new Error('DB insert error')); // For the second assertion
      await expect(dbLanguageStorage.createLanguage(newLang)).rejects.toSatisfy((e: StorageError) => e.code === 'STORAGE_ERROR');
    });

    it('should throw StorageError with DUPLICATE_ENTRY for unique constraint violation in DB for createLanguage', async () => {
      const newLang: InsertLanguage = { code: 'dup-lg', name: 'Duplicate Lang' };
      const dbError = new Error('duplicate key value violates unique constraint "languages_code_key"');
      (mockedDb.returning as any).mockRejectedValueOnce(dbError);
      await expect(dbLanguageStorage.createLanguage(newLang)).rejects.toThrow(StorageError);
      (mockedDb.returning as any).mockRejectedValueOnce(dbError); // For the second assertion
      await expect(dbLanguageStorage.createLanguage(newLang)).rejects.toSatisfy((e: StorageError) => e.code === 'DUPLICATE_ENTRY');
    });

    it('should throw StorageError if DB returns no data after insert for createLanguage', async () => {
      const newLang: InsertLanguage = { code: 'nodata-lg', name: 'No Data Lang' };
      (mockedDb.returning as any).mockResolvedValueOnce([]);
      await expect(dbLanguageStorage.createLanguage(newLang)).rejects.toThrow(StorageError);
      // Ensure the mock is reset or re-mocked if the same operation is called again with different mock behavior
      (mockedDb.returning as any).mockReset(); // Reset history and implementation
      (mockedDb.returning as any).mockResolvedValueOnce([]); // For the second assertion
      await expect(dbLanguageStorage.createLanguage(newLang)).rejects.toSatisfy((e: StorageError) => e.code === 'CREATE_FAILED');
    });
  });
});
