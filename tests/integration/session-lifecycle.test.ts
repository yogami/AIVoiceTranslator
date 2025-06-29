import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { SessionCleanupService } from '../../server/services/SessionCleanupService';
import { db } from '../../server/db';
import { sessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Session Lifecycle Integration Tests', () => {
  let cleanupService: SessionCleanupService;
  let testSessionIds: string[] = [];

  beforeAll(async () => {
    // Ensure test database is ready
    cleanupService = new SessionCleanupService();
  });

  afterAll(async () => {
    cleanupService?.stop();
    
    // Clean up any test sessions
    if (testSessionIds.length > 0) {
      await Promise.all(
        testSessionIds.map(sessionId =>
          db.delete(sessions).where(eq(sessions.sessionId, sessionId))
        )
      );
    }
  });

  beforeEach(() => {
    testSessionIds = [];
  });

  afterEach(async () => {
    // Clean up test sessions after each test
    if (testSessionIds.length > 0) {
      await Promise.all(
        testSessionIds.map(sessionId =>
          db.delete(sessions).where(eq(sessions.sessionId, sessionId))
        )
      );
      testSessionIds = [];
    }
  });

  const createTestSession = async (sessionData: {
    sessionId: string;
    studentsCount?: number;
    startTime?: Date;
    lastActivityAt?: Date;
    isActive?: boolean;
    qualityReason?: string | null;
  }) => {
    const session = {
      sessionId: sessionData.sessionId,
      studentsCount: sessionData.studentsCount ?? 0,
      startTime: sessionData.startTime ?? new Date(),
      lastActivityAt: sessionData.lastActivityAt ?? new Date(),
      isActive: sessionData.isActive ?? true,
      teacherLanguage: 'en',
      studentLanguage: 'es',
      quality: 'unknown' as const, // Use valid enum value
      qualityReason: sessionData.qualityReason ?? null,
      endTime: null,
      classCode: `TEST-${sessionData.sessionId.slice(-6)}`
    };

    await db.insert(sessions).values(session);
    testSessionIds.push(sessionData.sessionId);
    return session;
  };

  describe('Teacher Waiting Scenario - 10 Minute Timeout', () => {
    it('should clean up teacher sessions with no students after 10 minutes', async () => {
      // Create a session where teacher has been waiting for 15 minutes
      const sessionId = 'teacher-waiting-15min';
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        lastActivityAt: new Date(Date.now() - 15 * 60 * 1000),
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Check that session is now inactive
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].qualityReason).toContain('No students joined within 10 minutes');
    });

    it('should NOT clean up recent teacher sessions', async () => {
      // Create a session where teacher has been waiting for only 5 minutes
      const sessionId = 'teacher-waiting-5min';
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        lastActivityAt: new Date(Date.now() - 5 * 60 * 1000),
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Check that session is still active
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });

  describe('Students Disconnect Scenario - 5 Minute Grace Period', () => {
    it('should clean up sessions after 5 minute grace period when all students left', async () => {
      // Create a session that had students but they left 7 minutes ago
      const sessionId = 'students-left-7min';
      await createTestSession({
        sessionId,
        studentsCount: 2, // Had students
        startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago
        lastActivityAt: new Date(Date.now() - 7 * 60 * 1000), // Last activity 7 minutes ago
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Check that session is now inactive
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].qualityReason).toContain('All students disconnected, no activity for 5 minutes');
    });

    it('should NOT clean up sessions still in grace period', async () => {
      // Create a session where students left only 3 minutes ago
      const sessionId = 'students-left-3min';
      await createTestSession({
        sessionId,
        studentsCount: 1,
        startTime: new Date(Date.now() - 20 * 60 * 1000),
        lastActivityAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Check that session is still active
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });

  describe('Grace Period Cancellation', () => {
    it('should cancel grace period when students rejoin', async () => {
      // Create a session in grace period
      const sessionId = 'grace-period-test';
      await createTestSession({
        sessionId,
        studentsCount: 1,
        startTime: new Date(Date.now() - 20 * 60 * 1000),
        lastActivityAt: new Date(Date.now() - 4 * 60 * 1000),
        isActive: true,
        qualityReason: 'All students disconnected - grace period active'
      });

      // Student rejoins - cancel grace period
      await cleanupService.markStudentsRejoined(sessionId);

      // Check that grace period marker is cleared
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
      expect(result[0].qualityReason).toBeNull();
      expect(result[0].lastActivityAt.getTime()).toBeGreaterThan(Date.now() - 1000); // Updated recently
    });
  });

  describe('General Inactivity Cleanup - 30 Minutes', () => {
    it('should clean up sessions inactive for 30+ minutes', async () => {
      // Create a session that's been inactive for 35 minutes
      const sessionId = 'inactive-35min';
      await createTestSession({
        sessionId,
        studentsCount: 2,
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        lastActivityAt: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Check that session is now inactive
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].qualityReason).toContain('Session inactive for 30 minutes');
    });
  });

  describe('Activity Tracking', () => {
    it('should update session activity and prevent premature cleanup', async () => {
      // Create a session that would normally be cleaned up
      const sessionId = 'activity-test';
      await createTestSession({
        sessionId,
        studentsCount: 1,
        startTime: new Date(Date.now() - 40 * 60 * 1000),
        lastActivityAt: new Date(Date.now() - 32 * 60 * 1000), // 32 minutes ago - should be cleaned
        isActive: true
      });

      // Update activity to recent time
      await cleanupService.updateSessionActivity(sessionId);

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Session should still be active because we updated activity
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle sessions with zero students count correctly', async () => {
      const sessionId = 'zero-students';
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
        isActive: true
      });

      await cleanupService.cleanupStaleSessions();

      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      // Should be cleaned up under "no students joined" rule
      expect(result[0].isActive).toBe(false);
    });

    it('should handle manual session ending', async () => {
      const sessionId = 'manual-end';
      await createTestSession({
        sessionId,
        studentsCount: 2,
        isActive: true
      });

      await cleanupService.endSession(sessionId, 'Test manual ending');

      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result[0].isActive).toBe(false);
      expect(result[0].qualityReason).toBe('Test manual ending');
      expect(result[0].endTime).toBeTruthy();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple concurrent cleanup operations', async () => {
      // Create multiple test sessions
      const sessionIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
      
      await Promise.all(
        sessionIds.map(sessionId =>
          createTestSession({
            sessionId,
            studentsCount: 0,
            startTime: new Date(Date.now() - 15 * 60 * 1000),
            isActive: true
          })
        )
      );

      // Run multiple cleanups concurrently
      await Promise.all([
        cleanupService.cleanupStaleSessions(),
        cleanupService.cleanupStaleSessions(),
        cleanupService.cleanupStaleSessions()
      ]);

      // All sessions should be cleaned up
      const results = await db
        .select()
        .from(sessions)
        .where(eq(sessions.isActive, false));

      const cleanedSessionIds = results.map((s: any) => s.sessionId);
      sessionIds.forEach(sessionId => {
        expect(cleanedSessionIds).toContain(sessionId);
      });
    });
  });
});
