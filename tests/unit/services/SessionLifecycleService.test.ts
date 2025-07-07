import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionLifecycleService } from '../../../server/services/SessionLifecycleService';
import type { Session } from '../../../shared/schema';

// Mock storage interface
const mockStorage = {
  getAllActiveSessions: vi.fn(),
  getCurrentlyActiveSessions: vi.fn(),
  getSessionById: vi.fn(),
  getActiveSession: vi.fn(),
  updateSession: vi.fn(),
  endSession: vi.fn(),
  getRecentSessionActivity: vi.fn()
};

// Mock transcript storage
const mockTranscriptStorage = {
  getTranscriptCountBySession: vi.fn()
};

describe('SessionLifecycleService', () => {
  let sessionLifecycleService: SessionLifecycleService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    sessionLifecycleService = new SessionLifecycleService(mockStorage as any);
  });

  describe('classifySession', () => {
    it('should classify session as no_students when studentsCount is 0', () => {
      const startTime = new Date(Date.now() - 60000); // 1 minute ago
      const session: Session = {
        id: 1,
        sessionId: 'test-session',
        classCode: null,
        teacherLanguage: 'en-US',
        studentLanguage: null,
        startTime: startTime,
        endTime: new Date(), // Ended now, so duration > 30 seconds
        studentsCount: 0,
        totalTranslations: 0,
        averageLatency: null,
        isActive: false,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const result = sessionLifecycleService.classifySession(session, 5);
      
      expect(result.isReal).toBe(false);
      expect(result.reason).toBe('no_students');
      expect(result.studentsCount).toBe(0);
    });

    it('should classify session as no_activity when transcript count is 0', () => {
      const startTime = new Date(Date.now() - 60000); // 1 minute ago
      const session: Session = {
        id: 1,
        sessionId: 'test-session',
        classCode: null,
        teacherLanguage: 'en-US',
        studentLanguage: null,
        startTime: startTime,
        endTime: new Date(), // Ended now, so duration > 30 seconds
        studentsCount: 2,
        totalTranslations: 0,
        averageLatency: null,
        isActive: false,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const result = sessionLifecycleService.classifySession(session, 0);
      
      expect(result.isReal).toBe(false);
      expect(result.reason).toBe('no_activity');
      expect(result.transcriptCount).toBe(0);
    });

    it('should classify session as too_short when duration is less than minimum', () => {
      const startTime = new Date(Date.now() - 10000); // 10 seconds ago
      const session: Session = {
        id: 1,
        sessionId: 'test-session',
        classCode: null,
        teacherLanguage: 'en-US',
        studentLanguage: null,
        startTime: startTime,
        endTime: new Date(),
        studentsCount: 2,
        totalTranslations: 5,
        averageLatency: null,
        isActive: false,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const result = sessionLifecycleService.classifySession(session, 5);
      
      expect(result.isReal).toBe(false);
      expect(result.reason).toBe('too_short');
      expect(result.duration).toBeLessThan(30000);
    });

    it('should classify session as real when all criteria are met', () => {
      const startTime = new Date(Date.now() - 60000); // 1 minute ago
      const session: Session = {
        id: 1,
        sessionId: 'test-session',
        classCode: null,
        teacherLanguage: 'en-US',
        studentLanguage: null,
        startTime: startTime,
        endTime: null,
        studentsCount: 3,
        totalTranslations: 10,
        averageLatency: null,
        isActive: true,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const result = sessionLifecycleService.classifySession(session, 8);
      
      expect(result.isReal).toBe(true);
      expect(result.reason).toBe('real');
      expect(result.studentsCount).toBe(3);
      expect(result.transcriptCount).toBe(8);
    });
  });

  describe('updateSessionActivity', () => {
    it('should update lastActivityAt for session', async () => {
      const sessionId = 'test-session';
      mockStorage.getActiveSession.mockResolvedValueOnce({ 
        id: sessionId, 
        sessionId: sessionId,
        isActive: true 
      });
      mockStorage.updateSession.mockResolvedValueOnce({ id: 1 });

      await sessionLifecycleService.updateSessionActivity(sessionId);

      expect(mockStorage.getActiveSession).toHaveBeenCalledWith(sessionId);
      expect(mockStorage.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          lastActivityAt: expect.any(Date)
        })
      );
    });

    it('should skip update when session does not exist', async () => {
      const sessionId = 'non-existent-session';
      mockStorage.getActiveSession.mockResolvedValueOnce(null);

      await sessionLifecycleService.updateSessionActivity(sessionId);

      expect(mockStorage.getActiveSession).toHaveBeenCalledWith(sessionId);
      expect(mockStorage.updateSession).not.toHaveBeenCalled();
    });
  });

  describe('processInactiveSessions', () => {
    it('should end inactive sessions', async () => {
      const now = new Date();
      const oldTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
      
      mockStorage.getAllActiveSessions.mockResolvedValueOnce([
        {
          id: 1,
          sessionId: 'inactive-session',
          classCode: null,
          teacherLanguage: 'en-US',
          studentLanguage: null,
          startTime: oldTime,
          endTime: null,
          studentsCount: 0,
          totalTranslations: 0,
          averageLatency: null,
          isActive: true,
          quality: 'unknown',
          qualityReason: null,
          lastActivityAt: oldTime
        },
        {
          id: 2,
          sessionId: 'active-session',
          classCode: null,
          teacherLanguage: 'en-US',
          studentLanguage: null,
          startTime: new Date(now.getTime() - 60000), // 1 minute ago
          endTime: null,
          studentsCount: 1,
          totalTranslations: 0,
          averageLatency: null,
          isActive: true,
          quality: 'unknown',
          qualityReason: null,
          lastActivityAt: new Date(now.getTime() - 60000)
        }
      ]);

      mockStorage.endSession.mockResolvedValue({ id: 1 });

      const result = await sessionLifecycleService.processInactiveSessions();

      expect(mockStorage.updateSession).toHaveBeenCalledWith('inactive-session', expect.objectContaining({
        isActive: false,
        endTime: expect.any(Date),
        quality: expect.any(String),
        qualityReason: expect.any(String)
      }));
      expect(result.endedCount).toBe(1);
    });
  });

  describe('cleanupDeadSessions', () => {
    it('should classify and clean up dead sessions', async () => {
      const session1 = {
        id: 1,
        sessionId: 'session-1',
        classCode: null,
        teacherLanguage: 'en-US',
        studentLanguage: null,
        startTime: new Date(Date.now() - 600000), // 10 minutes ago
        endTime: new Date(),
        studentsCount: 0,
        totalTranslations: 0,
        averageLatency: null,
        isActive: false,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const session2 = {
        id: 2,
        sessionId: 'session-2',
        classCode: null,
        teacherLanguage: 'en-US',
        studentLanguage: null,
        startTime: new Date(Date.now() - 1800000), // 30 minutes ago
        endTime: new Date(),
        studentsCount: 3,
        totalTranslations: 15,
        averageLatency: null,
        isActive: false,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      // Mock getRecentSessionActivity to return activity data
      mockStorage.getRecentSessionActivity.mockResolvedValueOnce([
        { sessionId: 'session-1', transcriptCount: 0 },
        { sessionId: 'session-2', transcriptCount: 5 }
      ]);

      // Mock getSessionById to return the sessions
      mockStorage.getSessionById.mockImplementation((sessionId) => {
        if (sessionId === 'session-1') return Promise.resolve(session1);
        if (sessionId === 'session-2') return Promise.resolve(session2);
        return Promise.resolve(null);
      });

      mockStorage.updateSession.mockResolvedValue({ id: 1 });

      const result = await sessionLifecycleService.cleanupDeadSessions();

      expect(result.classified).toBe(2);
      expect(result.deadSessions).toBe(1);
      expect(result.realSessions).toBe(1);
    });
  });
});
