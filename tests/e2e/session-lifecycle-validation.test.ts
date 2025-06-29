import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SessionCleanupService } from '../../server/services/SessionCleanupService';
import { DatabaseStorage } from '../../server/database-storage';

/**
 * Session Lifecycle End-to-End Test
 * 
 * This test validates the core session lifecycle claims:
 * 1. Teacher waiting timeout (10 minutes)
 * 2. Student disconnect grace period (5 minutes) 
 * 3. General inactivity cleanup (30 minutes)
 */
describe('Session Lifecycle E2E Validation', () => {
  let cleanupService: SessionCleanupService;
  let storage: DatabaseStorage;

  beforeAll(async () => {
    storage = new DatabaseStorage();
    cleanupService = new SessionCleanupService();
  });

  afterAll(async () => {
    cleanupService?.stop();
  });

  describe('Teacher Waiting Scenario', () => {
    it('should validate that teachers waiting > 10 minutes get cleaned up', async () => {
      // Create a test session that simulates a teacher waiting for 15 minutes
      const testSessionId = `teacher-wait-test-${Date.now()}`;
      
      try {
        // Create session with teacher waiting for 15 minutes (past the 10 minute limit)
        await storage.createSession(testSessionId, {
          teacherLanguage: 'en-US',
          classCode: 'TEST123',
          startTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
          studentsCount: 0 // No students joined
        });

        // Verify session exists and is active
        let session = await storage.getActiveSession(testSessionId);
        expect(session).toBeDefined();
        expect(session?.isActive).toBe(true);
        expect(session?.studentsCount).toBe(0);

        // Run cleanup
        await cleanupService.cleanupStaleSessions();

        // Verify session is now inactive
        session = await storage.getSession(testSessionId);
        expect(session?.isActive).toBe(false);
        expect(session?.quality).toBe('no_students');
        expect(session?.qualityReason).toContain('No students joined within 10 minutes');

      } finally {
        // Cleanup
        try {
          await storage.deleteSession(testSessionId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    it('should NOT clean up recent teacher sessions', async () => {
      const testSessionId = `teacher-recent-test-${Date.now()}`;
      
      try {
        // Create session with teacher waiting for only 5 minutes
        await storage.createSession(testSessionId, {
          teacherLanguage: 'en-US',
          classCode: 'TEST456',
          startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          studentsCount: 0
        });

        // Run cleanup
        await cleanupService.cleanupStaleSessions();

        // Verify session is still active
        const session = await storage.getActiveSession(testSessionId);
        expect(session).toBeDefined();
        expect(session?.isActive).toBe(true);

      } finally {
        try {
          await storage.deleteSession(testSessionId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Student Disconnect Grace Period', () => {
    it('should clean up sessions after 5 minute grace period', async () => {
      const testSessionId = `student-grace-test-${Date.now()}`;
      
      try {
        // Create session that had students but they left 7 minutes ago
        await storage.createSession(testSessionId, {
          teacherLanguage: 'en-US',
          studentLanguage: 'es-ES',
          classCode: 'TEST789',
          startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 min ago
          studentsCount: 2, // Had students
          lastActivityAt: new Date(Date.now() - 7 * 60 * 1000) // Last activity 7 min ago
        });

        // Run cleanup
        await cleanupService.cleanupStaleSessions();

        // Verify session is now inactive
        const session = await storage.getSession(testSessionId);
        expect(session?.isActive).toBe(false);
        expect(session?.quality).toBe('no_activity');
        expect(session?.qualityReason).toContain('All students disconnected, no activity for 5 minutes');

      } finally {
        try {
          await storage.deleteSession(testSessionId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    it('should NOT clean up sessions still in grace period', async () => {
      const testSessionId = `student-grace-active-test-${Date.now()}`;
      
      try {
        // Create session where students left only 3 minutes ago
        await storage.createSession(testSessionId, {
          teacherLanguage: 'en-US',
          studentLanguage: 'es-ES',
          classCode: 'TEST012',
          startTime: new Date(Date.now() - 20 * 60 * 1000),
          studentsCount: 1,
          lastActivityAt: new Date(Date.now() - 3 * 60 * 1000) // 3 minutes ago - still in grace period
        });

        // Run cleanup
        await cleanupService.cleanupStaleSessions();

        // Verify session is still active
        const session = await storage.getActiveSession(testSessionId);
        expect(session).toBeDefined();
        expect(session?.isActive).toBe(true);

      } finally {
        try {
          await storage.deleteSession(testSessionId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Grace Period Cancellation', () => {
    it('should cancel grace period when students rejoin', async () => {
      const testSessionId = `grace-cancel-test-${Date.now()}`;
      
      try {
        // Create session in grace period state
        await storage.createSession(testSessionId, {
          teacherLanguage: 'en-US',
          studentLanguage: 'es-ES',
          classCode: 'TEST345',
          startTime: new Date(Date.now() - 20 * 60 * 1000),
          studentsCount: 1,
          lastActivityAt: new Date(Date.now() - 4 * 60 * 1000),
          qualityReason: 'All students disconnected - grace period active'
        });

        // Student rejoins - cancel grace period
        await cleanupService.markStudentsRejoined(testSessionId);

        // Verify grace period is cancelled
        const session = await storage.getActiveSession(testSessionId);
        expect(session).toBeDefined();
        expect(session?.isActive).toBe(true);
        expect(session?.qualityReason).toBeNull();
        
        // Verify lastActivityAt was updated
        const timeDiff = Date.now() - session!.lastActivityAt!.getTime();
        expect(timeDiff).toBeLessThan(2000); // Updated within last 2 seconds

      } finally {
        try {
          await storage.deleteSession(testSessionId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('General Inactivity', () => {
    it('should clean up sessions inactive for 30+ minutes', async () => {
      const testSessionId = `inactivity-test-${Date.now()}`;
      
      try {
        // Create session inactive for 35 minutes
        await storage.createSession(testSessionId, {
          teacherLanguage: 'en-US',
          studentLanguage: 'es-ES',
          classCode: 'TEST678',
          startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          studentsCount: 2,
          lastActivityAt: new Date(Date.now() - 35 * 60 * 1000) // 35 minutes ago
        });

        // Run cleanup
        await cleanupService.cleanupStaleSessions();

        // Verify session is now inactive
        const session = await storage.getSession(testSessionId);
        expect(session?.isActive).toBe(false);
        expect(session?.quality).toBe('no_activity');
        expect(session?.qualityReason).toContain('Session inactive for 30 minutes');

      } finally {
        try {
          await storage.deleteSession(testSessionId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Integration Flow', () => {
    it('should handle the complete student disconnect and rejoin flow', async () => {
      const testSessionId = `full-flow-test-${Date.now()}`;
      
      try {
        // Step 1: Create active session
        await storage.createSession(testSessionId, {
          teacherLanguage: 'en-US',
          studentLanguage: 'es-ES',
          classCode: 'FLOW123',
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          studentsCount: 2
        });

        let session = await storage.getActiveSession(testSessionId);
        expect(session?.isActive).toBe(true);

        // Step 2: Mark all students left (start grace period)
        await cleanupService.markAllStudentsLeft(testSessionId);

        session = await storage.getActiveSession(testSessionId);
        expect(session?.qualityReason).toBe('All students disconnected - grace period active');

        // Step 3: Students rejoin (cancel grace period)
        await cleanupService.markStudentsRejoined(testSessionId);

        session = await storage.getActiveSession(testSessionId);
        expect(session?.isActive).toBe(true);
        expect(session?.qualityReason).toBeNull();

        // Step 4: Students leave again and grace period expires
        await cleanupService.markAllStudentsLeft(testSessionId);
        
        // Simulate time passing (set lastActivityAt to 7 minutes ago)
        await storage.updateSession(testSessionId, {
          lastActivityAt: new Date(Date.now() - 7 * 60 * 1000)
        });

        // Step 5: Cleanup should now mark session as inactive
        await cleanupService.cleanupStaleSessions();

        session = await storage.getSession(testSessionId);
        expect(session?.isActive).toBe(false);

      } finally {
        try {
          await storage.deleteSession(testSessionId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });
});
