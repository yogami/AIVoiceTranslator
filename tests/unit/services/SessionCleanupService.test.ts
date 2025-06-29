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
    it('should clean up sessions inactive for 30+ minutes', async () => {
      const mockInactiveSessions = [
        {
          sessionId: 'session-1',
          lastActivityAt: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
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
});
