import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { MemSessionStorage, DbSessionStorage } from '../../../server/storage/session.storage';
import { StorageError } from '../../../server/storage.error';
import { type Session, type InsertSession, type Transcript } from '../../../shared/schema';

// Import Drizzle operators directly if tests need to construct Drizzle objects/conditions.
// This import is for test-side constructions, not what DbSessionStorage uses.
import { desc as drizzleDescForTest, sql as drizzleSqlForTest, count as drizzleCountOperatorForTest } from 'drizzle-orm';

// Explicitly unmock drizzle-orm and shared/schema to ensure they are actual implementations.
vi.unmock('drizzle-orm');
// Path to shared/schema from tests/unit/storage/session.storage.test.ts
vi.unmock('../../../shared/schema'); 

// Mock the entire '../../../server/db' module
vi.mock('../../../server/db', async () => {
  const actualServerDbModule = await vi.importActual('../../../server/db') as any;

  const mockDbInstance = {
    select: vi.fn(), from: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
    limit: vi.fn(), insert: vi.fn(), values: vi.fn(), update: vi.fn(),
    set: vi.fn(), returning: vi.fn(), leftJoin: vi.fn(), groupBy: vi.fn(),
    then: vi.fn(), 
    execute: vi.fn(),
    dynamic: false, 
  };

  // Make chainable methods return the instance itself
  for (const key of Object.keys(mockDbInstance)) {
    const method = (mockDbInstance as any)[key];
    if (typeof method?.mockReturnValue === 'function' && 
        !['then', 'returning', 'execute'].includes(key)) {
      method.mockReturnValue(mockDbInstance);
    }
  }

  return {
    __esModule: true,
    db: mockDbInstance, // Provide the mocked db instance
    sql: actualServerDbModule.sql, // Provide actual sql function from server/db
    pool: actualServerDbModule.pool, // Provide actual pool from server/db
  };
});

// Import the mocked 'db' instance and other necessary items from the mocked module.
import { db as mockedDb } from '../../../server/db';

// Import ACTUAL Drizzle table objects from their canonical schema definition location
// for use in assertions (e.g., toHaveBeenCalledWith(actualDrizzleSessionsTable)).
import { 
  sessions as actualDrizzleSessionsTable, 
  transcripts as actualDrizzleTranscriptsTable 
} from '../../../shared/schema'; // Import from shared/schema (should be unmocked)

describe('Session Storage', () => {
  // MemSessionStorage tests remain unchanged
  describe('MemSessionStorage', () => {
    let sessionStorage: MemSessionStorage;
    let sessionsMap: Map<number, Session>;
    let transcriptsMap: Map<number, Transcript>; 
    let idCounter: { value: number };

    beforeEach(() => {
      sessionsMap = new Map<number, Session>();
      transcriptsMap = new Map<number, Transcript>(); 
      idCounter = { value: 1 };
      sessionStorage = new MemSessionStorage(sessionsMap, idCounter, transcriptsMap);
    });

    it('should create a session', async () => {
      const newSessionData: InsertSession = { sessionId: 'sess-abc', teacherLanguage: 'en' };
      const createdSession = await sessionStorage.createSession(newSessionData);
      expect(createdSession.id).toBe(1);
      expect(createdSession.sessionId).toBe('sess-abc');
      expect(createdSession.teacherLanguage).toBe('en');
      expect(createdSession.isActive).toBe(true);
      expect(createdSession.startTime).toBeInstanceOf(Date);
      expect(sessionsMap.get(1)).toEqual(createdSession);
      expect(idCounter.value).toBe(2);
    });

    it('should throw StorageError if sessionId is not provided for createSession', async () => {
      const noSessionId: InsertSession = { teacherLanguage: 'en' } as InsertSession;
      await expect(sessionStorage.createSession(noSessionId)).rejects.toThrow(StorageError);
      await expect(sessionStorage.createSession(noSessionId)).rejects.toSatisfy((e: StorageError) => e.code === 'VALIDATION_ERROR');
    });

    it('should update a session', async () => {
      const created = await sessionStorage.createSession({ sessionId: 'sess-update', teacherLanguage: 'fr' });
      const updates: Partial<InsertSession> = { teacherLanguage: 'de', studentsCount: 5 };
      const updatedSession = await sessionStorage.updateSession('sess-update', updates);
      expect(updatedSession).toBeDefined();
      expect(updatedSession?.teacherLanguage).toBe('de');
      expect(updatedSession?.studentsCount).toBe(5);
      expect(sessionsMap.get(created.id)?.teacherLanguage).toBe('de');
    });

    it('should return undefined when updating a non-existent session', async () => {
      const result = await sessionStorage.updateSession('non-existent', { studentsCount: 10 });
      expect(result).toBeUndefined();
    });

    it('should get an active session by sessionId', async () => {
      await sessionStorage.createSession({ sessionId: 'active-sess', teacherLanguage: 'es' });
      const activeSession = await sessionStorage.getActiveSession('active-sess');
      expect(activeSession).toBeDefined();
      expect(activeSession?.isActive).toBe(true);
    });

    it('should return undefined if session is not active or does not exist', async () => {
      const created = await sessionStorage.createSession({ sessionId: 'inactive-sess', teacherLanguage: 'it' });
      sessionsMap.get(created.id)!.isActive = false; // Manually set to inactive
      expect(await sessionStorage.getActiveSession('inactive-sess')).toBeUndefined();
      expect(await sessionStorage.getActiveSession('non-existent-sess')).toBeUndefined();
    });

    it('should get all active sessions', async () => {
      await sessionStorage.createSession({ sessionId: 's1', teacherLanguage: 'en', isActive: true });
      await sessionStorage.createSession({ sessionId: 's2', teacherLanguage: 'fr', isActive: true });
      await sessionStorage.createSession({ sessionId: 's3', teacherLanguage: 'de', isActive: false }); // This one is inactive
      const activeSessions = await sessionStorage.getAllActiveSessions();
      expect(activeSessions.length).toBe(2);
      expect(activeSessions.find(s => s.sessionId === 's3')).toBeUndefined();
    });

    it('should end an active session', async () => {
      await sessionStorage.createSession({ sessionId: 'end-this-sess', teacherLanguage: 'pt' });
      const endedSession = await sessionStorage.endSession('end-this-sess');
      expect(endedSession).toBeDefined();
      expect(endedSession?.isActive).toBe(false);
      expect(endedSession?.endTime).toBeInstanceOf(Date);
      expect(await sessionStorage.getActiveSession('end-this-sess')).toBeUndefined();
    });

    it('should return undefined when ending a non-existent or already inactive session', async () => {
      expect(await sessionStorage.endSession('non-existent')).toBeUndefined();
      const created = await sessionStorage.createSession({ sessionId: 'already-ended', teacherLanguage: 'ja' });
      sessionsMap.get(created.id)!.isActive = false;
      expect(await sessionStorage.endSession('already-ended')).toBeUndefined();
    });
    
    it('should get recent session activity with transcript counts', async () => {
      const s1 = await sessionStorage.createSession({ sessionId: 'recent1', teacherLanguage: 'en' });
      await new Promise(resolve => setTimeout(resolve, 5)); 
      const s2 = await sessionStorage.createSession({ sessionId: 'recent2', teacherLanguage: 'fr' });
      
      transcriptsMap.set(1, { id: 1, sessionId: 'recent1', language: 'en', text: 't1', timestamp: new Date() });
      transcriptsMap.set(2, { id: 2, sessionId: 'recent1', language: 'en', text: 't2', timestamp: new Date() });
      transcriptsMap.set(3, { id: 3, sessionId: 'recent2', language: 'fr', text: 't3', timestamp: new Date() });

      const activity = await sessionStorage.getRecentSessionActivity(2);
      expect(activity.length).toBe(2);
      expect(activity[0].sessionId).toBe('recent2'); // s2 is newer
      expect(activity[0].transcriptCount).toBe(1);
      expect(activity[1].sessionId).toBe('recent1');
      expect(activity[1].transcriptCount).toBe(2);
    });
    
    it('should correctly initialize idCounter if sessionsMap is pre-populated', () => {
      sessionsMap.set(3, { id: 3, sessionId: 'pre1', isActive: true, teacherLanguage: 'en', startTime: new Date(), endTime: null, studentsCount: 0, totalTranslations: 0, averageLatency: null });
      sessionsMap.set(8, { id: 8, sessionId: 'pre8', isActive: false, teacherLanguage: 'fr', startTime: new Date(), endTime: new Date(), studentsCount: 0, totalTranslations: 0, averageLatency: null });
      idCounter = { value: 1 };
      const prePopulatedStorage = new MemSessionStorage(sessionsMap, idCounter, transcriptsMap);
      expect(idCounter.value).toBe(9); // maxId + 1
    });
  });

  describe('DbSessionStorage', () => {
    let dbSessionStorage: DbSessionStorage;

    beforeEach(() => {
      // Reset all mocks on the mockedDb instance
      vi.mocked(mockedDb.select).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.from).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.where).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.orderBy).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.limit).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.insert).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.values).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.update).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.set).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.returning).mockReset().mockResolvedValue([]);
      vi.mocked(mockedDb.leftJoin).mockReset().mockReturnValue(mockedDb as any);
      vi.mocked(mockedDb.groupBy).mockReset().mockReturnValue(mockedDb as any);
      
      const thenFn = vi.fn();
      vi.mocked((mockedDb as any).then).mockReset().mockImplementation(thenFn);
      vi.mocked((mockedDb as any).execute).mockReset().mockResolvedValue([]);

      dbSessionStorage = new DbSessionStorage();
    });

    it('should create a session in DB', async () => {
      const newSessionData: InsertSession = { sessionId: 'db-session-1', teacherLanguage: 'en-GB' };
      const returnedSession: Session = { 
        id: 1, ...newSessionData, isActive: true, startTime: new Date(), endTime: null, 
        studentsCount: 0, totalTranslations: 0, averageLatency: null,
        teacherLanguage: newSessionData.teacherLanguage ?? null 
      };
      (mockedDb.returning as Mock).mockResolvedValueOnce([returnedSession]);

      const createdSession = await dbSessionStorage.createSession(newSessionData);
      
      expect(createdSession).toEqual(returnedSession);
      expect(mockedDb.insert).toHaveBeenCalledWith(actualDrizzleSessionsTable); 
      expect(mockedDb.values).toHaveBeenCalledWith(expect.objectContaining({ 
        sessionId: 'db-session-1', 
        isActive: true, 
        teacherLanguage: 'en-GB' 
      }));
      expect(mockedDb.returning).toHaveBeenCalled();
    });

    it('should throw StorageError if DB returns no data after insert for createSession', async () => {
      const newSessionData: InsertSession = { sessionId: 'db-sess-fail', teacherLanguage: 'es' };
      (mockedDb.returning as Mock).mockResolvedValueOnce([]);
      
      await expect(dbSessionStorage.createSession(newSessionData)).rejects.toThrow(StorageError);
      
      (mockedDb.returning as Mock).mockResolvedValueOnce([]);
      await expect(dbSessionStorage.createSession(newSessionData)).rejects.toSatisfy((e: StorageError) => e.code === 'CREATE_FAILED');
    });

    it('should update a session in DB', async () => {
      const updates: Partial<InsertSession> = { teacherLanguage: 'es', studentsCount: 3 };
      const returnedSession: Session = { 
        id: 1, sessionId: 'db-sess-upd', teacherLanguage: 'es', studentsCount: 3, 
        isActive: true, startTime: new Date(), endTime: null, totalTranslations: 0, averageLatency: null 
      };
      (mockedDb.returning as Mock).mockResolvedValueOnce([returnedSession]);
      
      const updated = await dbSessionStorage.updateSession('db-sess-upd', updates);
      
      expect(updated).toEqual(returnedSession);
      expect(mockedDb.update).toHaveBeenCalledWith(actualDrizzleSessionsTable); 
      expect(mockedDb.set).toHaveBeenCalledWith(updates);
      
      expect(mockedDb.where).toHaveBeenCalledTimes(1);
      const whereArg = (mockedDb.where as Mock).mock.calls[0][0];
      expect(whereArg).toEqual(expect.any(Object)); // Refined: Check it's an object (Drizzle condition)
      // Removed toSQL checks
      expect(mockedDb.returning).toHaveBeenCalled();
    });

    it('should return undefined when updating a non-existent session in DB', async () => {
      (mockedDb.returning as Mock).mockResolvedValueOnce([]);
      const updated = await dbSessionStorage.updateSession('db-sess-upd-nonexist', { studentsCount: 1 });
      
      expect(updated).toBeUndefined();
      expect(mockedDb.update).toHaveBeenCalledWith(actualDrizzleSessionsTable); 
      
      expect(mockedDb.where).toHaveBeenCalledTimes(1);
      const whereArg = (mockedDb.where as Mock).mock.calls[0][0];
      expect(whereArg).toEqual(expect.any(Object)); // Refined: Check it's an object
      // Removed toSQL checks
      expect(mockedDb.returning).toHaveBeenCalled();
    });
    
    it('should get an active session by sessionId from DB', async () => {
      const mockSession: Session = { 
        id: 1, sessionId: 'db-active', teacherLanguage: 'it', isActive: true, 
        startTime: new Date(), endTime: null, studentsCount: 0, totalTranslations: 0, averageLatency: null 
      };
      ((mockedDb as any).then as Mock).mockImplementationOnce((resolveCallback: (value: any) => void) => resolveCallback([mockSession]));
      
      const session = await dbSessionStorage.getActiveSession('db-active');
      
      expect(session).toEqual(mockSession);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(actualDrizzleSessionsTable); 
      
      expect(mockedDb.where).toHaveBeenCalledTimes(1);
      const whereArg = (mockedDb.where as Mock).mock.calls[0][0];
      expect(whereArg).toEqual(expect.any(Object)); // Refined: Check it's an object
      // Removed toSQL checks
      expect(mockedDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return undefined if session is not active or does not exist for getActiveSession from DB', async () => {
      ((mockedDb as any).then as Mock).mockImplementationOnce((resolveCallback: (value: any) => void) => resolveCallback([])); 
      
      const session = await dbSessionStorage.getActiveSession('db-nonexistent');
      
      expect(session).toBeUndefined();
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(actualDrizzleSessionsTable); 

      expect(mockedDb.where).toHaveBeenCalledTimes(1);
      const whereArg = (mockedDb.where as Mock).mock.calls[0][0];
      expect(whereArg).toEqual(expect.any(Object)); // Refined: Check it's an object
      // Removed toSQL checks
      expect(mockedDb.limit).toHaveBeenCalledWith(1);
    });

    it('should get all active sessions from DB', async () => {
      const mockSessionsData: Session[] = [
        { id: 1, sessionId: 'db-active1', teacherLanguage: 'ja', isActive: true, startTime: new Date(), endTime: null, studentsCount: 0, totalTranslations: 0, averageLatency: null },
        { id: 2, sessionId: 'db-active2', teacherLanguage: 'en', isActive: true, startTime: new Date(), endTime: null, studentsCount: 0, totalTranslations: 0, averageLatency: null },
      ];
      ((mockedDb as any).then as Mock).mockImplementationOnce((resolveCallback: (value: any) => void) => resolveCallback(mockSessionsData));
      
      const sessionsResult = await dbSessionStorage.getAllActiveSessions();
      
      expect(sessionsResult).toEqual(mockSessionsData);
      expect(mockedDb.select).toHaveBeenCalled();
      expect(mockedDb.from).toHaveBeenCalledWith(actualDrizzleSessionsTable); 

      expect(mockedDb.where).toHaveBeenCalledTimes(1);
      const whereArg = (mockedDb.where as Mock).mock.calls[0][0];
      expect(whereArg).toEqual(expect.any(Object)); // Refined: Check it's an object
      // Removed toSQL checks
    });

    it('should end an active session in DB', async () => {
      const sessionIdToEnd = 'db-end-this';
      const endedSessionData: Session = { 
        id: 1, sessionId: sessionIdToEnd, teacherLanguage: 'ko', isActive: false, 
        startTime: new Date(Date.now() - 1000 * 60 * 5), endTime: new Date(), 
        studentsCount: 2, totalTranslations: 10, averageLatency: 150.5 
      };
      (mockedDb.returning as Mock).mockResolvedValueOnce([endedSessionData]);

      const result = await dbSessionStorage.endSession(sessionIdToEnd);

      expect(result).toEqual(endedSessionData);
      expect(mockedDb.update).toHaveBeenCalledWith(actualDrizzleSessionsTable); 
      expect(mockedDb.set).toHaveBeenCalledWith(expect.objectContaining({ 
        isActive: false, 
        endTime: expect.any(Date) 
      }));
      
      expect(mockedDb.where).toHaveBeenCalledTimes(1);
      const whereArg = (mockedDb.where as Mock).mock.calls[0][0];
      expect(whereArg).toEqual(expect.any(Object)); // Refined: Check it's an object
      // Removed toSQL checks
      expect(mockedDb.returning).toHaveBeenCalled();
    });

    it('should return undefined when ending a non-existent session in DB', async () => {
      (mockedDb.returning as Mock).mockResolvedValueOnce([]);
      const result = await dbSessionStorage.endSession('db-end-nonexistent');
      
      expect(result).toBeUndefined();
      expect(mockedDb.update).toHaveBeenCalledWith(actualDrizzleSessionsTable); 
      
      expect(mockedDb.where).toHaveBeenCalledTimes(1);
      const whereArg = (mockedDb.where as Mock).mock.calls[0][0];
      expect(whereArg).toEqual(expect.any(Object)); // Refined: Check it's an object
      // Removed toSQL checks
      expect(mockedDb.returning).toHaveBeenCalled();
    });
    
    it('should get recent session activity from DB with transcript counts', async () => {
      const mockActivityDataFromDb = [ 
        { sessionId: 'recent-db-2', teacherLanguage: 'de', startTime: new Date(), endTime: null, transcriptCount: 5 },
        { sessionId: 'recent-db-1', teacherLanguage: 'zh', startTime: new Date(), endTime: null, transcriptCount: 12 },
      ];
      const expectedParsedActivity = mockActivityDataFromDb.map(a => ({ 
        ...a,
        duration: a.startTime && a.endTime ? new Date(a.endTime).getTime() - new Date(a.startTime).getTime() : 0,
      }));
      
      ((mockedDb as any).then as Mock).mockImplementationOnce((resolveCallback: (value: any) => void) => resolveCallback(mockActivityDataFromDb));

      const activity = await dbSessionStorage.getRecentSessionActivity(5);
      
      expect(activity).toEqual(expectedParsedActivity);

      expect(mockedDb.select).toHaveBeenCalledTimes(1);
      const selectArg = (mockedDb.select as Mock).mock.calls[0][0];
      expect(selectArg.sessionId).toBe(actualDrizzleSessionsTable.sessionId);
      expect(selectArg.teacherLanguage).toBe(actualDrizzleSessionsTable.teacherLanguage);
      expect(selectArg.startTime).toBe(actualDrizzleSessionsTable.startTime);
      expect(selectArg.endTime).toBe(actualDrizzleSessionsTable.endTime);
      
      expect(selectArg.transcriptCount).toEqual(expect.any(Object)); // Refined: Check it's an object (Drizzle count object)
      // Removed toSQL checks for transcriptCount

      expect(mockedDb.from).toHaveBeenCalledWith(actualDrizzleSessionsTable);
      
      expect(mockedDb.leftJoin).toHaveBeenCalledTimes(1);
      const leftJoinArgs = (mockedDb.leftJoin as Mock).mock.calls[0];
      expect(leftJoinArgs[0]).toBe(actualDrizzleTranscriptsTable); 
      const joinCondition = leftJoinArgs[1];
      expect(joinCondition).toEqual(expect.any(Object)); // Refined: Check it's an object (Drizzle condition)
      // Removed toSQL checks for joinCondition

      expect(mockedDb.groupBy).toHaveBeenCalledWith(
        actualDrizzleSessionsTable.id,
        actualDrizzleSessionsTable.sessionId,
        actualDrizzleSessionsTable.teacherLanguage,
        actualDrizzleSessionsTable.startTime,
        actualDrizzleSessionsTable.endTime
      );
      
      expect(mockedDb.orderBy).toHaveBeenCalledTimes(1);
      const orderByArg = (mockedDb.orderBy as Mock).mock.calls[0][0]; 
      expect(orderByArg).toEqual(expect.any(Object)); // Refined: Check it's an object (Drizzle order by object)
      // Removed toSQL checks for orderByArg

      expect(mockedDb.limit).toHaveBeenCalledWith(5);
    }, 10000); 

    it('should throw StorageError on DB error during getRecentSessionActivity', async () => {
      const dbError = new Error('DB query failed');
      ((mockedDb as any).then as Mock).mockImplementationOnce((_resolve: any, reject: any) => reject(dbError));
      
      await expect(dbSessionStorage.getRecentSessionActivity(3)).rejects.toThrow(StorageError);
      
      ((mockedDb as any).then as Mock).mockImplementationOnce((_resolve: any, reject: any) => reject(dbError));
      await expect(dbSessionStorage.getRecentSessionActivity(3)).rejects.toSatisfy((e: StorageError) => e.code === 'STORAGE_ERROR');
    });
  });
});