import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemTranscriptStorage, DbTranscriptStorage } from '../../../server/storage/transcript.storage';
import { StorageError } from '../../../server/storage.error';
import { type Transcript, type InsertTranscript } from '../../../shared/schema';

// Mock the db module
vi.mock('../../../server/db', () => {
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
    // Make the instance itself thenable for select queries
    then: mockThen,
    // Drizzle specific property that might be checked
    dynamic: false
  };

  // Chainable methods return the instance itself
  mockDbInstance.select.mockReturnValue(mockDbInstance);
  mockDbInstance.from.mockReturnValue(mockDbInstance);
  mockDbInstance.where.mockReturnValue(mockDbInstance);
  mockDbInstance.orderBy.mockReturnValue(mockDbInstance);
  mockDbInstance.limit.mockReturnValue(mockDbInstance);
  mockDbInstance.insert.mockReturnValue(mockDbInstance);
  mockDbInstance.values.mockReturnValue(mockDbInstance);
  // `returning` is a finalizer for inserts/updates.
  // `then` is a finalizer for selects.

  return {
    db: mockDbInstance,
    // If you use sql template tags directly in transcript.storage.ts, mock it here too
    // sql: vi.fn().mockImplementation((strings, ...values) => ({ /* ... */ }))
  };
});

// Import the mocked db *after* vi.mock has been defined
import { db as mockedDb } from '../../../server/db';

const DEFAULT_TRANSCRIPT_QUERY_LIMIT = 100; // As defined in transcript.storage.ts

describe('Transcript Storage', () => {
  beforeEach(() => {
    const mocksToReset = [ // Renamed for clarity
      mockedDb.select, mockedDb.from, mockedDb.where, mockedDb.orderBy, mockedDb.limit,
      mockedDb.insert, mockedDb.values, mockedDb.returning, (mockedDb as any).then
    ];
    mocksToReset.forEach(mockFn => { // Renamed for clarity
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
    // mockedDb.returning is configured per test (for inserts)
    // (mockedDb as any).then is configured per test (for selects)
  });

  describe('MemTranscriptStorage', () => {
    let transcriptStorage: MemTranscriptStorage;
    let transcriptsMap: Map<number, Transcript>;
    let idCounter: { value: number };

    beforeEach(() => {
      transcriptsMap = new Map<number, Transcript>();
      idCounter = { value: 1 };
      transcriptStorage = new MemTranscriptStorage(transcriptsMap, idCounter);
    });

    it('should add a transcript', async () => {
      const newTranscriptData: InsertTranscript = {
        sessionId: 'session-123',
        language: 'en-US',
        text: 'Hello world',
      };
      const addedTranscript = await transcriptStorage.addTranscript(newTranscriptData);
      expect(addedTranscript.id).toBe(1);
      expect(addedTranscript.sessionId).toBe('session-123');
      expect(addedTranscript.text).toBe('Hello world');
      expect(addedTranscript.timestamp).toBeInstanceOf(Date);
      expect(transcriptsMap.get(1)).toEqual(addedTranscript);
      expect(idCounter.value).toBe(2);
    });

    it('should retrieve transcripts by session and language, sorted by timestamp desc', async () => {
      const session1LangEn = 'session-1';
      const session1LangFr = 'session-1'; // Same session, different language context if needed
      const session2LangEn = 'session-2';

      const t1 = await transcriptStorage.addTranscript({ sessionId: session1LangEn, language: 'en-US', text: 'First en' });
      await new Promise(resolve => setTimeout(resolve, 5)); // ensure different timestamps
      const t2 = await transcriptStorage.addTranscript({ sessionId: session1LangEn, language: 'en-US', text: 'Second en' });
      await new Promise(resolve => setTimeout(resolve, 5));
      const t3 = await transcriptStorage.addTranscript({ sessionId: session1LangFr, language: 'fr-FR', text: 'First fr' });
      await new Promise(resolve => setTimeout(resolve, 5));
      const t4 = await transcriptStorage.addTranscript({ sessionId: session2LangEn, language: 'en-US', text: 'Other session' });

      const s1EnTranscripts = await transcriptStorage.getTranscriptsBySession(session1LangEn, 'en-US');
      expect(s1EnTranscripts.length).toBe(2);
      expect(s1EnTranscripts[0].id).toBe(t2.id); // t2 is more recent than t1
      expect(s1EnTranscripts[1].id).toBe(t1.id);

      const s1FrTranscripts = await transcriptStorage.getTranscriptsBySession(session1LangFr, 'fr-FR');
      expect(s1FrTranscripts.length).toBe(1);
      expect(s1FrTranscripts[0].id).toBe(t3.id);
    });

    it('should respect the limit when retrieving transcripts', async () => {
      const sessionId = 'limit-test';
      await transcriptStorage.addTranscript({ sessionId, language: 'en-US', text: 'T1' });
      await new Promise(resolve => setTimeout(resolve, 5)); 
      await transcriptStorage.addTranscript({ sessionId, language: 'en-US', text: 'T2' });
      await new Promise(resolve => setTimeout(resolve, 5)); 
      await transcriptStorage.addTranscript({ sessionId, language: 'en-US', text: 'T3' });

      const limitedTranscripts = await transcriptStorage.getTranscriptsBySession(sessionId, 'en-US', 2);
      expect(limitedTranscripts.length).toBe(2);
      expect(limitedTranscripts[0].text).toBe('T3'); // Most recent
      expect(limitedTranscripts[1].text).toBe('T2');
    });

    it('should return empty array if no transcripts match session or language', async () => {
      await transcriptStorage.addTranscript({ sessionId: 's1', language: 'en', text: 'Hello' });
      const noSessionMatch = await transcriptStorage.getTranscriptsBySession('s2', 'en');
      expect(noSessionMatch.length).toBe(0);
      const noLangMatch = await transcriptStorage.getTranscriptsBySession('s1', 'fr');
      expect(noLangMatch.length).toBe(0);
    });
    
    it('should correctly initialize idCounter if transcriptsMap is pre-populated', () => {
      transcriptsMap.set(3, { id: 3, sessionId: 's1', language: 'en', text: 'pre1', timestamp: new Date() });
      transcriptsMap.set(8, { id: 8, sessionId: 's2', language: 'fr', text: 'pre2', timestamp: new Date() });
      idCounter = { value: 1 };
      const prePopulatedStorage = new MemTranscriptStorage(transcriptsMap, idCounter);
      expect(idCounter.value).toBe(9); // maxId + 1
    });
  });

  describe('DbTranscriptStorage', () => {
    let dbTranscriptStorage: DbTranscriptStorage;

    beforeEach(() => {
      // Mock setup is now handled by the outer beforeEach
      dbTranscriptStorage = new DbTranscriptStorage();
    });

    it('should add a transcript to DB', async () => {
      const newTranscriptData: InsertTranscript = { sessionId: 'db-session-1', language: 'en-GB', text: 'Database test' };
      const returnedTranscript: Transcript = { id: 1, ...newTranscriptData, timestamp: new Date() };
      (mockedDb.returning as any).mockResolvedValueOnce([returnedTranscript]);

      const createdTranscript = await dbTranscriptStorage.addTranscript(newTranscriptData);
      expect(createdTranscript).toEqual(returnedTranscript);
      expect(mockedDb.insert).toHaveBeenCalledWith(expect.anything()); // transcripts table
      expect(mockedDb.values).toHaveBeenCalledWith(newTranscriptData);
      expect(mockedDb.returning).toHaveBeenCalled();
    });

    it('should retrieve transcripts by session and language from DB', async () => {
      const mockTranscripts: Transcript[] = [
        { id: 1, sessionId: 'db-s2', language: 'es-ES', text: 'Hola DB', timestamp: new Date() },
        { id: 2, sessionId: 'db-s2', language: 'es-ES', text: 'Como estas', timestamp: new Date(Date.now() - 1000) }, // Older
      ];
      // Mock the resolution of the select query using 'then'
      (mockedDb as any).then.mockImplementationOnce((resolve: any) => {
        resolve(mockTranscripts); // Drizzle select resolves with an array of results
      });

      const transcripts = await dbTranscriptStorage.getTranscriptsBySession('db-s2', 'es-ES', 10);
      expect(transcripts).toEqual(mockTranscripts);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(expect.anything()); // transcripts table
      expect(mockedDb.where).toHaveBeenCalledWith(expect.anything()); // and(eq(sessionId), eq(language))
      expect(mockedDb.orderBy).toHaveBeenCalledWith(expect.anything()); // desc(timestamp)
      expect(mockedDb.limit).toHaveBeenCalledWith(10);
      expect((mockedDb as any).then).toHaveBeenCalled(); // Ensure the thenable was invoked
      expect(mockedDb.returning).not.toHaveBeenCalled(); // returning is not for selects
    });

    it('should use default limit if not provided for DB retrieval', async () => {
      // Mock the resolution of the select query using 'then'
      (mockedDb as any).then.mockImplementationOnce((resolve: any) => {
        resolve([]); // Resolve with empty array for this test case
      });
      await dbTranscriptStorage.getTranscriptsBySession('db-s3', 'de-DE');
      expect(mockedDb.limit).toHaveBeenCalledWith(DEFAULT_TRANSCRIPT_QUERY_LIMIT);
      expect((mockedDb as any).then).toHaveBeenCalled();
      expect(mockedDb.returning).not.toHaveBeenCalled();
    });

    it('should throw StorageError if DB returns no data after insert', async () => {
      const newTranscriptData: InsertTranscript = { sessionId: 'db-session-fail', language: 'en-GB', text: 'DB fail test' };
      (mockedDb.returning as any).mockResolvedValueOnce([]);
      await expect(dbTranscriptStorage.addTranscript(newTranscriptData)).rejects.toThrow(StorageError);
      (mockedDb.returning as any).mockResolvedValueOnce([]); // For the second assertion
      await expect(dbTranscriptStorage.addTranscript(newTranscriptData)).rejects.toSatisfy((e: StorageError) => e.code === 'CREATE_FAILED');
    });

    it('should throw StorageError on generic DB error during addTranscript', async () => {
      const newTranscriptData: InsertTranscript = { sessionId: 'db-session-generic-error', language: 'en-GB', text: 'DB generic error' };
      (mockedDb.returning as any).mockRejectedValueOnce(new Error('Some DB error'));
      await expect(dbTranscriptStorage.addTranscript(newTranscriptData)).rejects.toThrow(StorageError);
      (mockedDb.returning as any).mockRejectedValueOnce(new Error('Some DB error')); // For the second assertion
      await expect(dbTranscriptStorage.addTranscript(newTranscriptData)).rejects.toSatisfy((e: StorageError) => e.code === 'STORAGE_ERROR');
    });

    it('should throw StorageError on generic DB error during getTranscriptsBySession', async () => {
      // Mock the select query to reject
      ((mockedDb as any).then as any).mockImplementationOnce((_resolve: any, reject: any) => {
        reject(new Error('Some DB select error'));
      });
      await expect(dbTranscriptStorage.getTranscriptsBySession('db-s-generic-error', 'en-US')).rejects.toThrow(StorageError);
      
      ((mockedDb as any).then as any).mockImplementationOnce((_resolve: any, reject: any) => {
        reject(new Error('Some DB select error'));
      });
      await expect(dbTranscriptStorage.getTranscriptsBySession('db-s-generic-error', 'en-US')).rejects.toSatisfy((e: StorageError) => e.code === 'STORAGE_ERROR');
      expect(((mockedDb as any).then as any)).toHaveBeenCalledTimes(2); // Corrected assertion for 'then'
    });
  });
});
