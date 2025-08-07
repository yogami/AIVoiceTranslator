import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SessionLifecycleManager, 
  SessionQuality, 
  type SessionMetrics 
} from '../../../../server/services/session/SessionLifecycleManager';

describe('SessionLifecycleManager', () => {
  let lifecycleManager: SessionLifecycleManager;

  beforeEach(() => {
    vi.clearAllMocks();
    lifecycleManager = new SessionLifecycleManager();
  });

  describe('SessionQuality enum', () => {
    it('should have correct quality levels', () => {
      expect(SessionQuality.DEAD).toBe('dead');
      expect(SessionQuality.MINIMAL).toBe('minimal');
      expect(SessionQuality.ACTIVE).toBe('active');
      expect(SessionQuality.COMPLETE).toBe('complete');
    });
  });

  describe('classifySession', () => {
    const createdAt = new Date(Date.now() - 10000); // 10 seconds ago

    it('should classify dead session with no activity', () => {
      const metrics: SessionMetrics = {
        connectionDurationMs: 1000,
        studentCount: 0,
        translationCount: 0,
        transcriptCount: 0,
        lastActivityTimestamp: new Date(Date.now() - 360000), // 6 minutes ago
        teacherInteractionCount: 0
      };

      const quality = lifecycleManager.classifySession(metrics, createdAt);
      expect(quality).toBe(SessionQuality.DEAD);
    });

    it('should classify minimal session with basic activity', () => {
      const metrics: SessionMetrics = {
        connectionDurationMs: 5000,
        studentCount: 1,
        translationCount: 1, // Below threshold for active
        transcriptCount: 1,
        lastActivityTimestamp: new Date(),
        teacherInteractionCount: 1
      };

      const quality = lifecycleManager.classifySession(metrics, createdAt);
      expect(quality).toBe(SessionQuality.MINIMAL);
    });

    it('should classify active session with moderate activity', () => {
      const metrics: SessionMetrics = {
        connectionDurationMs: 30000,
        studentCount: 3,
        translationCount: 5, // Above threshold for active
        transcriptCount: 8,
        lastActivityTimestamp: new Date(),
        teacherInteractionCount: 5
      };

      const quality = lifecycleManager.classifySession(metrics, createdAt);
      expect(quality).toBe(SessionQuality.ACTIVE);
    });

    it('should classify complete session with high activity', () => {
      const metrics: SessionMetrics = {
        connectionDurationMs: 1800000, // 30 minutes
        studentCount: 10,
        translationCount: 50,
        transcriptCount: 45,
        lastActivityTimestamp: new Date(),
        teacherInteractionCount: 20
      };

      const quality = lifecycleManager.classifySession(metrics, createdAt);
      expect(quality).toBe(SessionQuality.COMPLETE);
    });
  });

  describe('shouldCleanupSession', () => {
    it('should recommend cleanup for dead sessions', () => {
      const metrics: SessionMetrics = {
        connectionDurationMs: 500,
        studentCount: 0,
        translationCount: 0,
        transcriptCount: 0,
        lastActivityTimestamp: new Date(Date.now() - 360000), // 6 minutes ago
        teacherInteractionCount: 0
      };

      const shouldCleanup = lifecycleManager.shouldCleanupSession(SessionQuality.DEAD, metrics);
      expect(shouldCleanup).toBe(true);
    });

    it('should not recommend cleanup for active sessions with recent activity', () => {
      const metrics: SessionMetrics = {
        connectionDurationMs: 30000,
        studentCount: 5,
        translationCount: 15,
        transcriptCount: 12,
        lastActivityTimestamp: new Date(),
        teacherInteractionCount: 8
      };

      const shouldCleanup = lifecycleManager.shouldCleanupSession(SessionQuality.ACTIVE, metrics);
      expect(shouldCleanup).toBe(false);
    });
  });

  describe('shouldIncludeInAnalytics', () => {
    it('should include active sessions in analytics', () => {
      const shouldInclude = lifecycleManager.shouldIncludeInAnalytics(SessionQuality.ACTIVE);
      expect(shouldInclude).toBe(true);
    });

    it('should include complete sessions in analytics', () => {
      const shouldInclude = lifecycleManager.shouldIncludeInAnalytics(SessionQuality.COMPLETE);
      expect(shouldInclude).toBe(true);
    });

    it('should not include dead sessions in analytics', () => {
      const shouldInclude = lifecycleManager.shouldIncludeInAnalytics(SessionQuality.DEAD);
      expect(shouldInclude).toBe(false);
    });

    it('should not include minimal sessions in analytics', () => {
      const shouldInclude = lifecycleManager.shouldIncludeInAnalytics(SessionQuality.MINIMAL);
      expect(shouldInclude).toBe(false);
    });
  });

  describe('shouldAutoCleanup', () => {
    it('should auto cleanup dead sessions', () => {
      const shouldCleanup = lifecycleManager.shouldAutoCleanup(SessionQuality.DEAD);
      expect(shouldCleanup).toBe(true);
    });

    it('should not auto cleanup active sessions', () => {
      const shouldCleanup = lifecycleManager.shouldAutoCleanup(SessionQuality.ACTIVE);
      expect(shouldCleanup).toBe(false);
    });
  });
});
