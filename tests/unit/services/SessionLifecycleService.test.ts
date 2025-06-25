import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionLifecycleService } from '../../../server/services/SessionLifecycleService';
import type { Session, Transcript, Translation } from '../../../shared/schema';

// Mock storage interface
const mockStorage = {
  getAllActiveSessions: vi.fn(),
  getSessionById: vi.fn(),
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
      const session: Session = {
        id: 1,
        sessionId: 'test-session-1',
        teacherLanguage: 'en-US',
        startTime: new Date(Date.now() - 60000), // 1 minute ago
        endTime: null,
        studentsCount: 0,
        totalTranslations: 0,
        averageLatency: null,
        isActive: true,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const classification = sessionLifecycleService.classifySession(session, 0);

      expect(classification.isReal).toBe(false);
      expect(classification.reason).toBe('no_students');
      expect(classification.studentsCount).toBe(0);
    });

    it('should classify session as no_activity when students joined but no translations or transcripts', () => {
      const session: Session = {
        id: 1,
        sessionId: 'test-session-2',
        teacherLanguage: 'en-US',
        startTime: new Date(Date.now() - 120000), // 2 minutes ago
        endTime: null,
        studentsCount: 2,
        totalTranslations: 0,
        averageLatency: null,
        isActive: true,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const classification = sessionLifecycleService.classifySession(session, 0);

      expect(classification.isReal).toBe(false);
      expect(classification.reason).toBe('no_activity');
      expect(classification.studentsCount).toBe(2);
    });

    it('should classify session as too_short when duration is less than 30 seconds', () => {
      const session: Session = {
        id: 1,
        sessionId: 'test-session-3',
        teacherLanguage: 'en-US',
        startTime: new Date(Date.now() - 20000), // 20 seconds ago
        endTime: new Date(),
        studentsCount: 1,
        totalTranslations: 0,
        averageLatency: null,
        isActive: false,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const classification = sessionLifecycleService.classifySession(session, 0);

      expect(classification.isReal).toBe(false);
      expect(classification.reason).toBe('too_short');
      expect(classification.duration).toBeLessThan(30000);
    });

    it('should classify session as real when criteria are met', () => {
      const session: Session = {
        id: 1,
        sessionId: 'test-session-4',
        teacherLanguage: 'en-US',
        startTime: new Date(Date.now() - 300000), // 5 minutes ago
        endTime: null,
        studentsCount: 3,
        totalTranslations: 5,
        averageLatency: null,
        isActive: true,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: new Date()
      };

      const classification = sessionLifecycleService.classifySession(session, 2);

      expect(classification.isReal).toBe(true);
      expect(classification.reason).toBe('real');
      expect(classification.studentsCount).toBe(3);
      expect(classification.totalTranslations).toBe(5);
      expect(classification.transcriptCount).toBe(2);
    });
  });

  describe('updateSessionActivity', () => {
    it('should update lastActivityAt for session', async () => {
      const sessionId = 'test-session';
      mockStorage.updateSession.mockResolvedValueOnce({ id: 1 });

      await sessionLifecycleService.updateSessionActivity(sessionId);

      expect(mockStorage.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          lastActivityAt: expect.any(Date)
        })
      );
    });
  });

  describe('processInactiveSessions', () => {
    it('should identify and end inactive sessions', async () => {
      const inactiveTime = 5 * 60 * 1000; // 5 minutes
      const now = new Date();
      const oldTime = new Date(now.getTime() - inactiveTime - 60000); // 6 minutes ago

      const activeSessions: Session[] = [
        {
          id: 1,
          sessionId: 'inactive-session',
          teacherLanguage: 'en-US',
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
          teacherLanguage: 'en-US',
          startTime: new Date(now.getTime() - 60000), // 1 minute ago
          endTime: null,
          studentsCount: 1,
          totalTranslations: 0,
          averageLatency: null,
          isActive: true,
          quality: 'unknown',
          qualityReason: null,
          lastActivityAt: new Date(now.getTime() - 30000) // 30 seconds ago
        }
      ];

      mockStorage.getAllActiveSessions.mockResolvedValueOnce(activeSessions);
      mockStorage.updateSession.mockResolvedValue({ id: 1 });

      const result = await sessionLifecycleService.processInactiveSessions(inactiveTime);

      expect(result.endedCount).toBe(1);
      expect(result.classifiedCount).toBe(1);
      expect(mockStorage.updateSession).toHaveBeenCalledWith(
        'inactive-session',
        expect.objectContaining({
          isActive: false,
          endTime: expect.any(Date),
          quality: 'no_students',
          qualityReason: expect.stringContaining('No students joined')
        })
      );
    });
  });

  describe('cleanupDeadSessions', () => {
    it('should classify sessions based on activity and update quality', async () => {
      const sessions: Session[] = [
        {
          id: 1,
          sessionId: 'session-1',
          teacherLanguage: 'en-US',
          startTime: new Date(Date.now() - 600000), // 10 minutes ago
          endTime: new Date(),
          studentsCount: 0,
          totalTranslations: 0,
          averageLatency: null,
          isActive: false,
          quality: 'unknown',
          qualityReason: null,
          lastActivityAt: new Date()
        },
        {
          id: 2,
          sessionId: 'session-2',
          teacherLanguage: 'en-US',
          startTime: new Date(Date.now() - 1800000), // 30 minutes ago
          endTime: new Date(),
          studentsCount: 3,
          totalTranslations: 10,
          averageLatency: null,
          isActive: false,
          quality: 'unknown',
          qualityReason: null,
          lastActivityAt: new Date()
        }
      ];

      mockStorage.getRecentSessionActivity.mockResolvedValueOnce(sessions.map(s => ({
        sessionId: s.sessionId,
        teacherLanguage: s.teacherLanguage,
        transcriptCount: s.sessionId === 'session-2' ? 5 : 0,
        studentCount: s.studentsCount,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.endTime && s.startTime ? s.endTime.getTime() - s.startTime.getTime() : 0
      })));

      mockStorage.getSessionById.mockImplementation((sessionId: string) => 
        Promise.resolve(sessions.find(s => s.sessionId === sessionId))
      );
      mockStorage.updateSession.mockResolvedValue({ id: 1 });

      const result = await sessionLifecycleService.cleanupDeadSessions();

      expect(result.classified).toBe(2);
      expect(result.deadSessions).toBe(1);
      expect(result.realSessions).toBe(1);

      // Verify session-1 was marked as dead
      expect(mockStorage.updateSession).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          quality: 'no_students',
          qualityReason: expect.stringContaining('No students joined')
        })
      );

      // Verify session-2 was marked as real
      expect(mockStorage.updateSession).toHaveBeenCalledWith(
        'session-2',
        expect.objectContaining({
          quality: 'real',
          qualityReason: expect.stringContaining('Session had meaningful activity')
        })
      );
    });
  });
});
