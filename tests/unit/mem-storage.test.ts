import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../../server/mem-storage';
import { type Session, type InsertSession } from '../../shared/schema';

describe('MemStorage', () => {
  let memStorage: MemStorage;

  beforeEach(() => {
    memStorage = new MemStorage();
  });

  describe('getSessionById', () => {
    it('should return a session if it exists', async () => {
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

    it('should return undefined if a session does not exist', async () => {
      const foundSession = await memStorage.getSessionById('non-existent-session');
      expect(foundSession).toBeUndefined();
    });

    it('should return a session even if it is inactive', async () => {
      const sessionData: InsertSession = {
        sessionId: 'test-session-inactive-456',
        isActive: false, // Initially inactive or became inactive
        teacherLanguage: 'en-US',
        studentsCount: 0,
        totalTranslations: 0,
        averageLatency: 0,
      };

      const createdActiveSession = await memStorage.createSession({
        sessionId: 'test-session-inactive-456',
        isActive: true,
        teacherLanguage: 'en-US',
        studentsCount: 0,
        totalTranslations: 0,
        averageLatency: 0,
      });
      await memStorage.endSession('test-session-inactive-456'); // Make it inactive

      const foundSession = await memStorage.getSessionById('test-session-inactive-456');
      expect(foundSession).toBeDefined();
      expect(foundSession?.sessionId).toBe('test-session-inactive-456');
      expect(foundSession?.isActive).toBe(false);
    });
  });
});
