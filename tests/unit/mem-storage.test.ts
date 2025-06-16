import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../../server/mem-storage';
import { DatabaseStorage } from '../../server/database-storage';
import { type Session, type InsertSession } from '../../shared/schema';

// Use DatabaseStorage for all operations, MemStorage is now just a wrapper

describe('MemStorage (DB-backed wrapper)', () => {
  let memStorage: MemStorage;
  let dbStorage: DatabaseStorage;

  beforeEach(async () => {
    dbStorage = new DatabaseStorage(); // This should connect to a test DB or in-memory DB
    if (typeof dbStorage.reset === 'function') {
      process.env.NODE_ENV = 'test';
      await dbStorage.reset();
    }
    memStorage = new MemStorage(dbStorage); // Pass dbStorage to MemStorage wrapper
  });

  describe('getSessionById', () => {
    it('should return a session if it exists (DB-backed)', async () => {
      const sessionData: InsertSession = {
        sessionId: 'test-session-123',
        isActive: true,
        teacherLanguage: 'en-US', 
        studentsCount: 0,
        totalTranslations: 0,
        averageLatency: 0,
      };
      const createdSession = await memStorage.createSession(sessionData);
      const foundSession = await memStorage.getSessionById('test-session-123');
      expect(foundSession).toBeDefined();
      expect(foundSession?.sessionId).toBe('test-session-123');
      expect(foundSession?.id).toBe(createdSession.id);
    });

    it('should return undefined if a session does not exist (DB-backed)', async () => {
      const foundSession = await memStorage.getSessionById('non-existent-session');
      expect(foundSession).toBeUndefined();
    });

    it('should return a session even if it is inactive (DB-backed)', async () => {
      const sessionData: InsertSession = {
        sessionId: 'test-session-inactive-456',
        isActive: true, // Start as active
        teacherLanguage: 'en-US',
        studentsCount: 0,
        totalTranslations: 0,
        averageLatency: 0,
      };
      const createdActiveSession = await memStorage.createSession(sessionData);
      await memStorage.endSession('test-session-inactive-456'); // Make it inactive
      const foundSession = await memStorage.getSessionById('test-session-inactive-456');
      expect(foundSession).toBeDefined();
      expect(foundSession?.sessionId).toBe('test-session-inactive-456');
      expect(foundSession?.isActive).toBe(false);
    });
  });
});
