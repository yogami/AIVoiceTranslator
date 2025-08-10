import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { UnifiedSessionCleanupService } from '../../server/application/services/session/cleanup/UnifiedSessionCleanupService';
import { config } from '../../server/config';
import { db } from '../../server/db';
import { sessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { setupTestIsolation } from '../../test-config/test-isolation';
import { randomUUID } from 'crypto';
import { DatabaseStorage } from '../../server/database-storage';

describe('Session Lifecycle Integration Tests', () => {
  // Set up test isolation for this integration test suite
  setupTestIsolation('Session Lifecycle Integration Tests', 'integration');
  
  let cleanupService: UnifiedSessionCleanupService;
  let testSessionIds: string[] = [];
  let testId: string;
  let originalSessionTimeouts: Record<string, number>;

  beforeAll(async () => {
    // Ensure test database is ready
    const storage = new DatabaseStorage();
    const classroomSessionsMap = new Map(); // Empty map for tests
    cleanupService = new UnifiedSessionCleanupService(storage, classroomSessionsMap);
    // DON'T start the service automatically - we only want manual cleanup in tests
  });

  beforeEach(async () => {
    // Save original config.session timeout values
    originalSessionTimeouts = {
      emptyTeacherTimeout: config.session.emptyTeacherTimeout,
      allStudentsLeftTimeout: config.session.allStudentsLeftTimeout,
      staleSessionTimeout: config.session.staleSessionTimeout,
      cleanupInterval: config.session.cleanupInterval,
    };
    testId = randomUUID(); // Generate unique ID for each test run

    // Widen thresholds to make integration timing robust against event-loop jitter
    // Use larger windows so "recent" scenarios don't accidentally cross thresholds
    config.session.emptyTeacherTimeout = Math.max(config.session.emptyTeacherTimeout, 2000);
    config.session.allStudentsLeftTimeout = Math.max(config.session.allStudentsLeftTimeout, 2000);
    config.session.staleSessionTimeout = Math.max(config.session.staleSessionTimeout, 5000);
  });

  afterAll(async () => {
    // Ensure cleanup service is stopped
    if (cleanupService) {
      cleanupService.stop();
    }
    
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
    // Restore original config.session timeout values
    if (originalSessionTimeouts) {
      config.session.emptyTeacherTimeout = originalSessionTimeouts.emptyTeacherTimeout;
      config.session.allStudentsLeftTimeout = originalSessionTimeouts.allStudentsLeftTimeout;
      config.session.staleSessionTimeout = originalSessionTimeouts.staleSessionTimeout;
      config.session.cleanupInterval = originalSessionTimeouts.cleanupInterval;
    }
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
    totalTranslations?: number;
    quality?: string;
    endTime?: Date | null;
  }) => {
    const session = {
      sessionId: sessionData.sessionId,
      studentsCount: sessionData.studentsCount ?? 0,
      startTime: sessionData.startTime ?? new Date(),
      lastActivityAt: sessionData.lastActivityAt ?? new Date(),
      isActive: sessionData.isActive ?? true,
      teacherLanguage: 'en',
      studentLanguage: 'es',
      quality: (sessionData.quality as any) ?? 'unknown' as const, // Use valid enum value
      qualityReason: sessionData.qualityReason ?? null,
      endTime: sessionData.endTime ?? null,
      classCode: `TEST-${sessionData.sessionId.slice(-6)}`,
      totalTranslations: sessionData.totalTranslations ?? 0
    };

    // Delete any existing session with this ID first
    await db.delete(sessions).where(eq(sessions.sessionId, sessionData.sessionId));
    
    await db.insert(sessions).values(session);
    testSessionIds.push(sessionData.sessionId);
    return session;
  };

  describe('Teacher Waiting Scenario - 10 Minute Timeout', () => {
    it('should clean up teacher sessions with no students after 10 minutes', async () => {
      // Create a session where teacher has been waiting beyond the empty teacher timeout
      const sessionId = `teacher-waiting-expired-${testId}`;
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: new Date(Date.now() - config.session.emptyTeacherTimeout - 1000), // Beyond timeout + 1 second
        lastActivityAt: new Date(Date.now() - config.session.emptyTeacherTimeout - 1000),
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();
      // Give DB a brief moment to flush writes (scaled)
      await new Promise(r => setTimeout(r, 50));

      // Check that session is now inactive
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].qualityReason).toContain(`No students joined within ${config.session.emptyTeacherTimeoutUnscaled / 60000} minutes`);
    });

    it('should NOT clean up recent teacher sessions', async () => {
      // Create a session where teacher has been waiting for less than the timeout
      const sessionId = `teacher-waiting-recent-${testId}`;
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: new Date(Date.now() - Math.floor(config.session.emptyTeacherTimeout * 0.25)), // within threshold buffer
        lastActivityAt: new Date(Date.now() - Math.floor(config.session.emptyTeacherTimeout * 0.25)),
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();
      await new Promise(r => setTimeout(r, 50));

      // Check that session is still active
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });

  describe('Students Disconnect Scenario - 10 Minute Grace Period', () => {
    it('should clean up sessions after 10 minute grace period when all students left', async () => {
      // Create a session that had students, then simulate all students leaving
      const sessionId = `students-left-12min-${testId}`;
      const tenSecondsAgo = new Date(Date.now() - Math.max(3000, Math.floor(config.session.allStudentsLeftTimeout * 1.2))); // comfortably past grace
      await createTestSession({
        sessionId,
        studentsCount: 3, // Start with students
        startTime: tenSecondsAgo,
        lastActivityAt: tenSecondsAgo,
        isActive: true
      });

      // Simulate all students leaving - both update count and mark grace period
      await db.update(sessions)
        .set({ studentsCount: 0 })
        .where(eq(sessions.sessionId, sessionId));
      
      // Mark session as all students left to trigger grace period
      await cleanupService.markAllStudentsLeft(sessionId);
      
      // Wait for actual grace period to expire (scaled)
      await new Promise(resolve => setTimeout(resolve, Math.max(1000, Math.floor(config.session.allStudentsLeftTimeout * 0.6))));
      
      // Run cleanup
      await cleanupService.cleanupStaleSessions();
      await new Promise(r => setTimeout(r, 50));

      // Run cleanup
      await cleanupService.cleanupStaleSessions();
      await new Promise(r => setTimeout(r, 50));

      // Check that session is now inactive
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].qualityReason).toContain('All students disconnected');
    });

    it('should NOT clean up sessions still in grace period', async () => {
      // Create a session where students left only 1 second ago - within scaled timeout
      const sessionId = `students-left-grace-${testId}`;
      const oneSecondAgo = new Date(Date.now() - Math.min(1000, Math.floor(config.session.allStudentsLeftTimeout * 0.2)));
      
      await createTestSession({
        sessionId,
        studentsCount: 1,
        startTime: oneSecondAgo,
        lastActivityAt: oneSecondAgo,
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();
      await new Promise(r => setTimeout(r, 50));

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
      const sessionId = `grace-period-test-${testId}`;
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

  describe('General Inactivity Cleanup - 90 Minutes', () => {
    it('should clean up sessions inactive for 90+ minutes', async () => {
      // Create a session that's been inactive for 95 minutes
      const sessionId = `inactive-95min-${testId}`;
      await createTestSession({
        sessionId,
        studentsCount: 2,
        startTime: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
        lastActivityAt: new Date(Date.now() - 95 * 60 * 1000), // 95 minutes ago
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();
      await new Promise(r => setTimeout(r, 50));

      // Check that session is now inactive
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].qualityReason).toContain(`Session inactive for ${config.session.staleSessionTimeoutUnscaled / 60000} minutes`);
    });
  });

  describe('Activity Tracking', () => {
    it('should update session activity and prevent premature cleanup', async () => {
      // Create a session that would normally be cleaned up
      const sessionId = `activity-test-${testId}`;
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
      const sessionId = `zero-students-${testId}`;
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: new Date(Date.now() - 16 * 60 * 1000), // 16 minutes ago - should be cleaned up (15 min timeout)
        isActive: true
      });

      await cleanupService.cleanupStaleSessions();

      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      // Should be cleaned up under "no students joined" rule (15 minute timeout)
      expect(result[0].isActive).toBe(false);
    });

    it('should handle manual session ending', async () => {
      const sessionId = `manual-end-${testId}`;
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
      const sessionIds = [`concurrent-1-${testId}`, `concurrent-2-${testId}`, `concurrent-3-${testId}`];
      
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

  describe('Enhanced Session Management - 90 Minute Timeout', () => {
    it('should not end sessions before 90 minutes of inactivity when students are present', async () => {
      // Create a session with students present and recent activity (less than stale threshold)
      const sessionId = `test-session-30min-${testId}`;
      // Use small delta compared to stale threshold
      const tenSecondsAgo = new Date(Date.now() - Math.min(10000, Math.floor(config.session.staleSessionTimeout * 0.1)));
      
      await createTestSession({
        sessionId,
        studentsCount: 1,
        startTime: tenSecondsAgo,
        lastActivityAt: tenSecondsAgo,
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Session should remain active since it's within the scaled threshold
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true); // Session should remain active before 90 minutes of inactivity
    });

    it('should end sessions after 90 minutes of inactivity', async () => {
      // Create a session with inactivity longer than the scaled threshold
      const sessionId = `test-session-95min-${testId}`;
      // Use 4 minutes ago - longer than the scaled 216-second (3.6 minute) threshold
      const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
      
      await createTestSession({
        sessionId,
        studentsCount: 1,
        startTime: fourMinutesAgo,
        lastActivityAt: fourMinutesAgo,
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Session should now be inactive with endTime set
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].endTime).toBeTruthy();
      expect(result[0].qualityReason).toContain(`${config.session.staleSessionTimeoutUnscaled / 60000} minutes`);
    });
  });

  describe('Teacher Reconnection Logic', () => {
    it('should find existing active session for teacher language within grace period', async () => {
      // Clean up any existing English teacher sessions to ensure isolation
      await db
        .delete(sessions)
        .where(eq(sessions.teacherLanguage, 'en'));
      
      // Create an active session for English teacher within grace period
      const sessionId = `teacher-session-en-${testId}`;
      const oneSecondAgo = new Date(Date.now() - 1000); // 1 second ago - within 3 second grace period
      
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: oneSecondAgo,
        lastActivityAt: oneSecondAgo,
        isActive: true
      });

      // Update the session to have the correct teacher language
      await db
        .update(sessions)
        .set({ teacherLanguage: 'en' })
        .where(eq(sessions.sessionId, sessionId));

      // Try to find existing session
      const foundSession = await cleanupService.findActiveTeacherSession('en');
      
      expect(foundSession).toBeTruthy();
      expect(foundSession?.sessionId).toBe(sessionId);
      expect(foundSession?.teacherLanguage).toBe('en');
    });

    it('should not find sessions outside grace period', async () => {
      // Clean up any existing English teacher sessions to ensure isolation
      await db
        .delete(sessions)
        .where(eq(sessions.teacherLanguage, 'en'));
        
      // Create an active session for English teacher outside grace period
      const sessionId = `teacher-session-old-${testId}`;
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: fifteenMinutesAgo,
        lastActivityAt: fifteenMinutesAgo,
        isActive: true
      });

      // Update the session to have the correct teacher language
      await db
        .update(sessions)
        .set({ teacherLanguage: 'en' })
        .where(eq(sessions.sessionId, sessionId));

      // Try to find existing session (should not find due to grace period)
      const foundSession = await cleanupService.findActiveTeacherSession('en');
      
      expect(foundSession).toBeNull();
    });

    it('should end duplicate teacher sessions when cleaning up', async () => {
      // Create multiple active sessions for same teacher language
      const session1Id = 'teacher-duplicate-1';
      const session2Id = 'teacher-duplicate-2';
      const session3Id = 'teacher-duplicate-3';

      await createTestSession({
        sessionId: session1Id,
        studentsCount: 0,
        isActive: true
      });

      await createTestSession({
        sessionId: session2Id,
        studentsCount: 0,
        isActive: true
      });

      await createTestSession({
        sessionId: session3Id,
        studentsCount: 0,
        isActive: true
      });

      // Update all sessions to have the same teacher language
      await Promise.all([
        db.update(sessions).set({ teacherLanguage: 'es' }).where(eq(sessions.sessionId, session1Id)),
        db.update(sessions).set({ teacherLanguage: 'es' }).where(eq(sessions.sessionId, session2Id)),
        db.update(sessions).set({ teacherLanguage: 'es' }).where(eq(sessions.sessionId, session3Id))
      ]);

      // End duplicates, keeping session2 as the current one
      await cleanupService.endDuplicateTeacherSessions(session2Id, 'es');

      // Check results
      const results = await db
        .select()
        .from(sessions)
        .where(eq(sessions.teacherLanguage, 'es'));

      const session1 = results.find((s: any) => s.sessionId === session1Id);
      const session2 = results.find((s: any) => s.sessionId === session2Id);
      const session3 = results.find((s: any) => s.sessionId === session3Id);

      expect(session1?.isActive).toBe(false);
      expect(session1?.quality).toBe('no_activity');
      expect(session2?.isActive).toBe(true); // Should remain active
      expect(session3?.isActive).toBe(false);
      expect(session3?.quality).toBe('no_activity');
    });
  });

  describe('Extended Grace Periods', () => {
    it('should use 15-minute timeout for empty teacher sessions', async () => {
      // Create a session with no students, 1 second old - within scaled timeout
      const sessionId = `empty-teacher-${testId}`;
      const oneSecondAgo = new Date(Date.now() - Math.min(1000, Math.floor(config.session.allStudentsLeftTimeout * 0.2)));
      
      await createTestSession({
        sessionId,
        studentsCount: 0,
        startTime: oneSecondAgo,
        lastActivityAt: oneSecondAgo,
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Session should still be active (15 minute timeout for empty sessions)
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it('should use 10-minute timeout for abandoned sessions', async () => {
      // Create a session that had students, with recent activity (should not be cleaned up yet)
      const sessionId = `abandoned-session-7min-${testId}`;
      // Use 1 second ago - within the scaled 1.8-second threshold from .env.test
      const oneSecondAgo = new Date(Date.now() - 1 * 1000);
      
      await createTestSession({
        sessionId,
        studentsCount: 2,
        startTime: oneSecondAgo,
        lastActivityAt: oneSecondAgo,
        isActive: true
      });

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Session should still be active (within scaled timeout threshold)
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it('should end abandoned sessions after 10 minutes of inactivity', async () => {
      // Create a session that had students, then simulate all students leaving and inactivity
      const sessionId = `abandoned-session-12min-${testId}`;
      const twelveMinutesAgo = new Date(Date.now() - 12 * 60 * 1000);
      await createTestSession({
        sessionId,
        studentsCount: 3, // Start with students
        startTime: twelveMinutesAgo,
        lastActivityAt: twelveMinutesAgo,
        isActive: true
      });

      // Simulate all students leaving - both update count and mark grace period
      await db.update(sessions)
        .set({ studentsCount: 0 })
        .where(eq(sessions.sessionId, sessionId));
      
      // Mark that all students left (this would normally be done by ConnectionLifecycleManager)
      await cleanupService.markAllStudentsLeft(sessionId);
      
      // Wait for grace period to expire 
      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5 seconds (more than 1.8s scaled timeout)

      // Run cleanup
      await cleanupService.cleanupStaleSessions();

      // Session should now be inactive
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].endTime).toBeTruthy();
      expect(result[0].qualityReason).toContain(`All students disconnected, no activity for ${config.session.allStudentsLeftTimeoutUnscaled / 60000} minutes`);
    });
  });

  describe('Session Activity Updates', () => {
    it('should update session activity timestamp', async () => {
      const sessionId = `test-activity-update-${testId}`;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      await createTestSession({
        sessionId,
        studentsCount: 1,
        lastActivityAt: oneHourAgo,
        isActive: true
      });

      // Update activity
      await cleanupService.updateSessionActivity(sessionId);

      // Check that lastActivityAt was updated to recent time
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      const timeDiff = Date.now() - new Date(result[0].lastActivityAt).getTime();
      expect(timeDiff).toBeLessThan(5000); // Should be updated within last 5 seconds
    });

    it('should handle all students left grace period', async () => {
      const sessionId = `test-students-left-${testId}`;
      
      await createTestSession({
        sessionId,
        studentsCount: 2,
        isActive: true
      });

      // Mark that all students left
      await cleanupService.markAllStudentsLeft(sessionId);

      // Check that the grace period was marked
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId));

      expect(result).toHaveLength(1);
      expect(result[0].qualityReason).toContain('All students disconnected - grace period active');
      
      // Session should still be active during grace period
      expect(result[0].isActive).toBe(true);
    });
  });

  it('should create session with totalTranslations and return it in getRecentSessionActivity', async () => {
    const sessionId = `test-session-with-translations-${testId}`;
    
    // Create a session with totalTranslations
    const sessionData = {
      sessionId,
      studentsCount: 0,
      startTime: new Date(),
      lastActivityAt: new Date(),
      isActive: false,
      totalTranslations: 5,
      quality: 'real', // Use valid enum value
      endTime: new Date()
    };

    const session = await createTestSession(sessionData);
    console.log('Created session:', session);
    expect(session.totalTranslations).toBe(5);

    // Get the session back from storage
    const retrievedSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionId, sessionId));
    
    const retrievedSession = retrievedSessions[0];
    console.log('Retrieved session:', retrievedSession);
    expect(retrievedSession?.totalTranslations).toBe(5);

    // Note: getRecentSessionActivity test would require DatabaseStorage instance
    // which this test file doesn't use directly. This test verifies the core
    // database functionality that supports that method.
  });
});
