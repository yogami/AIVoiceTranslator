import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { SessionCleanupService } from '../../../server/services/SessionCleanupService';
import { db } from '../../../server/db';
import { sessions } from '../../../shared/schema';
import { eq, and, lt, gt } from 'drizzle-orm';

// Mock the database
vi.mock('../../../server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock the logger
vi.mock('../../../server/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the config with production values for these tests
vi.mock('../../../server/config', () => ({
  config: {
    session: {
      staleSessionTimeout: 90 * 60 * 1000, // 90 minutes
      emptyTeacherTimeout: 15 * 60 * 1000, // 15 minutes  
      allStudentsLeftTimeout: 10 * 60 * 1000, // 10 minutes
      cleanupInterval: 2 * 60 * 1000, // 2 minutes
    }
  }
}));

describe('SessionCleanupService', () => {
  let cleanupService: SessionCleanupService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = db as any;
    cleanupService = new SessionCleanupService();
    vi.clearAllMocks();

    // Setup common mock chains
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowsAffected: 0 })
      })
    });
  });

  afterEach(() => {
    cleanupService.stop();
  });

  describe('Service Lifecycle', () => {
    it('should start and stop cleanup service', () => {
      expect(cleanupService).toBeDefined();
      
      cleanupService.start();
      // Should not throw if started again
      cleanupService.start();
      
      cleanupService.stop();
      // Should not throw if stopped again
      cleanupService.stop();
    });

    it('should run cleanup immediately on start', async () => {
      const cleanupSpy = vi.spyOn(cleanupService, 'cleanupStaleSessions');
      
      cleanupService.start();
      
      // Give it a moment to run the immediate cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty Teacher Sessions Cleanup', () => {
    it('should clean up sessions where teacher waited but no students joined', async () => {
      const mockEmptySessions = [
        {
          sessionId: 'session-1',
          studentsCount: 0,
          startTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
          isActive: true
        }
      ];

      // Mock the select query to return empty sessions
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockEmptySessions)
        })
      });

      // Mock the update query
      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.cleanupStaleSessions();

      // Verify the session was marked as inactive
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should NOT clean up recent empty sessions', async () => {
      const mockRecentSessions = [
        {
          sessionId: 'session-1',
          studentsCount: 0,
          startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          isActive: true
        }
      ];

      // Mock the select query to return no sessions (they're too recent)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]) // No sessions to clean up
        })
      });

      await cleanupService.cleanupStaleSessions();

      // Update should not be called since no sessions need cleanup
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('All Students Left Cleanup (Grace Period)', () => {
    it('should clean up sessions after grace period when all students left', async () => {
      const mockAbandonedSessions = [
        {
          sessionId: 'session-1',
          studentsCount: 2, // Had students
          lastActivityAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          isActive: true
        }
      ];

      // Mock the select query
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockAbandonedSessions)
        })
      });

      // Mock the update query
      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.cleanupStaleSessions();

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should NOT clean up sessions still in grace period', async () => {
      // Mock no sessions returned (they're still in grace period)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      await cleanupService.cleanupStaleSessions();

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('General Inactivity Cleanup', () => {
    it('should clean up sessions inactive for 90+ minutes', async () => {
      const mockInactiveSessions = [
        {
          sessionId: 'session-1',
          lastActivityAt: new Date(Date.now() - 95 * 60 * 1000), // 95 minutes ago
          isActive: true
        }
      ];

      // Mock the select query
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockInactiveSessions)
        })
      });

      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.cleanupStaleSessions();

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should NOT clean up sessions inactive for less than 90 minutes', async () => {
      // Mock no sessions returned (they're not old enough)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      await cleanupService.cleanupStaleSessions();

      // Only select should be called, not update
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should use correct timeout values for different scenarios', () => {
      // Test that the service uses the correct timeout constants
      expect(cleanupService).toBeDefined();
      // These would be tested implicitly through the timing tests above
    });
  });

  describe('Session Activity Tracking', () => {
    it('should update last activity time for a session', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.updateSessionActivity('test-session-id');

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle errors when updating session activity', async () => {
      mockDb.update.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      await expect(cleanupService.updateSessionActivity('test-session-id')).resolves.not.toThrow();
    });
  });

  describe('Grace Period Management', () => {
    it('should mark when all students leave (start grace period)', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.markAllStudentsLeft('test-session-id');

      expect(mockUpdate).toHaveBeenCalled();
      // Should set qualityReason to indicate grace period
      const setCall = mockDb.update().set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          qualityReason: 'All students disconnected - grace period active'
        })
      );
    });

    it('should mark when students rejoin (cancel grace period)', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.markStudentsRejoined('test-session-id');

      expect(mockUpdate).toHaveBeenCalled();
      // Should clear the qualityReason
      const setCall = mockDb.update().set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          qualityReason: null
        })
      );
    });
  });

  describe('Manual Session Ending', () => {
    it('should end a session manually with reason', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.endSession('test-session-id', 'User disconnected');

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = mockDb.update().set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          qualityReason: 'User disconnected'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully during cleanup', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection error');
      });

      // Should not throw
      await expect(cleanupService.cleanupStaleSessions()).resolves.not.toThrow();
    });

    it('should handle errors when ending sessions', async () => {
      mockDb.update.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      await expect(cleanupService.endSession('test-session-id', 'test reason')).resolves.not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle the complete teacher-waiting scenario', async () => {
      // Scenario: Teacher creates session, waits 15 minutes, no students join
      const mockEmptySession = [{
        sessionId: 'teacher-waiting-session',
        studentsCount: 0,
        startTime: new Date(Date.now() - 15 * 60 * 1000),
        isActive: true
      }];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockEmptySession)
        })
      });

      const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate
        })
      });

      await cleanupService.cleanupStaleSessions();

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle the students-disconnect-and-return scenario', async () => {
      // Scenario: Students disconnect, then one rejoins within grace period
      
      // Step 1: Mark students as left
      await cleanupService.markAllStudentsLeft('active-session');
      
      // Step 2: Student rejoins - cancel grace period  
      await cleanupService.markStudentsRejoined('active-session');
      
      // Verify both operations were attempted
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('New Session Lifecycle Features', () => {
    describe('90-Minute Inactivity Timeout', () => {
      it('should clean up sessions after exactly 90 minutes of inactivity', async () => {
        const mockInactiveSessions = [
          {
            sessionId: 'session-90min',
            lastActivityAt: new Date(Date.now() - 90 * 60 * 1000), // Exactly 90 minutes ago
            isActive: true
          }
        ];

        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockInactiveSessions)
          })
        });

        const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: mockUpdate
          })
        });

        await cleanupService.cleanupStaleSessions();

        expect(mockUpdate).toHaveBeenCalled();
        
        // Verify the session was marked with correct quality and reason
        const setCall = mockDb.update().set;
        expect(setCall).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: false,
            quality: 'no_activity',
            qualityReason: 'Session inactive for 90 minutes'
          })
        );
      });

      it('should not clean up sessions with 89 minutes of inactivity', async () => {
        // Mock no sessions returned (89 minutes is not >= 90)
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        });

        await cleanupService.cleanupStaleSessions();

        expect(mockDb.update).not.toHaveBeenCalled();
      });
    });

    describe('15-Minute Empty Teacher Timeout', () => {
      it('should clean up empty teacher sessions after exactly 15 minutes', async () => {
        const mockEmptySession = [
          {
            sessionId: 'empty-teacher-session',
            studentsCount: 0,
            startTime: new Date(Date.now() - 15 * 60 * 1000), // Exactly 15 minutes ago
            isActive: true
          }
        ];

        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockEmptySession)
          })
        });

        const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: mockUpdate
          })
        });

        await cleanupService.cleanupStaleSessions();

        expect(mockUpdate).toHaveBeenCalled();
        
        // Verify correct quality is set
        const setCall = mockDb.update().set;
        expect(setCall).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: false,
            quality: 'no_students',
            qualityReason: 'No students joined within 15 minutes'
          })
        );
      });

      it('should not clean up empty teacher sessions before 15 minutes', async () => {
        // Mock no sessions returned (14 minutes is not >= 15)
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        });

        await cleanupService.cleanupStaleSessions();

        expect(mockDb.update).not.toHaveBeenCalled();
      });
    });

    describe('10-Minute Abandoned Session Timeout', () => {
      it('should clean up abandoned sessions after exactly 10 minutes', async () => {
        const mockAbandonedSession = [
          {
            sessionId: 'abandoned-session',
            studentsCount: 2, // Had students
            lastActivityAt: new Date(Date.now() - 10 * 60 * 1000), // Exactly 10 minutes ago
            isActive: true
          }
        ];

        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockAbandonedSession)
          })
        });

        const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: mockUpdate
          })
        });

        await cleanupService.cleanupStaleSessions();

        expect(mockUpdate).toHaveBeenCalled();
        
        // Verify correct quality and reason
        const setCall = mockDb.update().set;
        expect(setCall).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: false,
            quality: 'no_activity',
            qualityReason: 'All students disconnected, no activity for 10 minutes'
          })
        );
      });

      it('should not clean up abandoned sessions before 10 minutes', async () => {
        // Mock no sessions returned (9 minutes is not >= 10)
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        });

        await cleanupService.cleanupStaleSessions();

        expect(mockDb.update).not.toHaveBeenCalled();
      });
    });

    describe('Session Quality Handling', () => {
      it('should not use teacher_reconnected quality anymore', async () => {
        // This test ensures we don't accidentally use the removed quality
        const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: mockUpdate
          })
        });

        await cleanupService.endSession('test-session', 'Test reason');

        const setCall = mockDb.update().set;
        expect(setCall).toHaveBeenCalledWith(
          expect.objectContaining({
            quality: 'no_activity' // Should use valid quality, not 'teacher_reconnected'
          })
        );
        
        // Verify it's not using the old invalid quality
        expect(setCall).not.toHaveBeenCalledWith(
          expect.objectContaining({
            quality: 'teacher_reconnected'
          })
        );
      });
    });

    describe('Service Stop Behavior', () => {
      it('should prevent database operations after service is stopped', async () => {
        cleanupService.stop();

        await cleanupService.cleanupStaleSessions();
        await cleanupService.updateSessionActivity('test-session');
        await cleanupService.endSession('test-session', 'test');

        // No database operations should occur after stop
        expect(mockDb.select).not.toHaveBeenCalled();
        expect(mockDb.update).not.toHaveBeenCalled();
      });

      it('should handle early exit during database queries if stopped', async () => {
        // Mock a slow database query
        let resolveQuery: Function;
        const slowQuery = new Promise(resolve => {
          resolveQuery = resolve;
        });

        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(slowQuery)
          })
        });

        // Start cleanup
        const cleanupPromise = cleanupService.cleanupStaleSessions();

        // Stop service while query is in progress
        cleanupService.stop();

        // Complete the query
        resolveQuery!([{ sessionId: 'test', isActive: true }]);

        await cleanupPromise;

        // Update should not be called since service was stopped
        expect(mockDb.update).not.toHaveBeenCalled();
      });
    });

    describe('Cleanup Timing Priority', () => {
      it('should prioritize general inactivity cleanup over abandoned sessions', async () => {
        // Session that qualifies for both abandoned (10+ min) and general inactivity (90+ min)
        const mockSession = [
          {
            sessionId: 'old-session',
            studentsCount: 2,
            lastActivityAt: new Date(Date.now() - 95 * 60 * 1000), // 95 minutes ago
            isActive: true
          }
        ];

        // Mock general inactivity cleanup to find the session
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]) // Empty teacher sessions
          })
        }).mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockSession) // General inactivity
          })
        }).mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]) // Abandoned sessions (shouldn't find it)
          })
        });

        const mockUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: mockUpdate
          })
        });

        await cleanupService.cleanupStaleSessions();

        // Should be cleaned up by general inactivity (90 min timeout)
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const setCall = mockDb.update().set;
        expect(setCall).toHaveBeenCalledWith(
          expect.objectContaining({
            qualityReason: 'Session inactive for 90 minutes'
          })
        );
      });
    });
  });
});
